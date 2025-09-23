import React, { useState, useEffect, useCallback } from 'react'
import { validateProxy, ProxyValidationResult as UtilProxyValidationResult } from '../../utils/proxy-validator'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconRefresh, IconAlertCircle, IconCheck, IconX, IconLoader2 } from '@tabler/icons-react'
import { useWebSocket, MessageType, ConnectionStatus } from '@/lib/websocket-service'
import { useToast } from '@/hooks/use-toast'

// Proxy validation result
export interface ProxyValidationResult {
  proxy: string
  isValid: boolean
  responseTime?: number
  anonymityLevel?: 'transparent' | 'anonymous' | 'elite'
  country?: string
  isp?: string
  protocol?: string
  error?: string
}

// Proxy validator props
interface ProxyValidatorProps {
  onValidationComplete?: (results: ProxyValidationResult[]) => void
  onProxiesAdded?: (validProxies: string[]) => void
  initialProxies?: string[]
  maxProxies?: number
}

export function ProxyValidator({
  onValidationComplete,
  onProxiesAdded,
  initialProxies = [],
  maxProxies = 100
}: ProxyValidatorProps) {
  const { toast } = useToast()

  // WebSocket connection
  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws/connect`
  const { status: wsStatus, connect, disconnect, send, on, off } = useWebSocket(wsUrl, {
    reconnectInterval: 2000,
    maxReconnectAttempts: 5,
    pingInterval: 30000,
    debug: false,
  })

  // State
  const [proxies, setProxies] = useState<string[]>(initialProxies)
  const [proxyInput, setProxyInput] = useState<string>('')
  const [validationResults, setValidationResults] = useState<ProxyValidationResult[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>('input')

  // Connect to WebSocket on mount
  useEffect(() => {
    // Get auth token from localStorage
    const token = localStorage.getItem('token')

    // Connect to WebSocket
    connect(token || undefined)

    // Clean up on unmount
    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // Handle validation updates
  useEffect(() => {
    const handleValidationUpdate = (message: any) => {
      if (message.type !== MessageType.PROXY_VALIDATION) return

      if (message.progress) {
        setProgress(message.progress)
      }

      if (message.result) {
        setValidationResults(prev => {
          const existingIndex = prev.findIndex(r => r.proxy === message.result.proxy)

          if (existingIndex >= 0) {
            const updated = [...prev]
            updated[existingIndex] = message.result
            return updated
          } else {
            return [...prev, message.result]
          }
        })
      }

      if (message.complete) {
        setIsValidating(false)

        if (onValidationComplete) {
          onValidationComplete(validationResults)
        }

        // Extract valid proxies
        const validProxies = validationResults
          .filter(result => result.isValid)
          .map(result => result.proxy)

        if (validProxies.length > 0 && onProxiesAdded) {
          onProxiesAdded(validProxies)
        }

        toast({
          title: 'Validation complete',
          description: `${validProxies.length} valid proxies found out of ${validationResults.length} tested`
        })

        // Switch to results tab
        setActiveTab('results')
      }
    }

    // Register message handler
    on(MessageType.PROXY_VALIDATION, handleValidationUpdate)

    // Clean up
    return () => {
      off(MessageType.PROXY_VALIDATION, handleValidationUpdate)
    }
  }, [on, off, onValidationComplete, onProxiesAdded, validationResults, toast])

  // Parse proxies from input
  const parseProxies = useCallback((input: string) => {
    // Split by newline, comma, or space
    const lines = input.split(/[\\n,\\s]+/).filter(Boolean)

    // Basic proxy format validation and deduplication
    const uniqueProxies = Array.from(new Set(
      lines.map(line => line.trim()).filter(line => {
        // Very basic validation - should contain at least one : character
        return line.includes(':')
      })
    ))

    return uniqueProxies.slice(0, maxProxies)
  }, [maxProxies])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setProxyInput(e.target.value)

    // Parse proxies on input change
    const parsedProxies = parseProxies(e.target.value)
    setProxies(parsedProxies)
  }

  // Start validation
  const startValidation = useCallback(async () => {
    if (proxies.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No proxies to validate',
        description: 'Please enter at least one proxy'
      })
      return
    }

    setIsValidating(true)
    setProgress(0)
    setValidationResults([])
    setError(null)

    try {
      // Try WebSocket first
      if (wsStatus === ConnectionStatus.CONNECTED) {
        send({
          type: MessageType.PROXY_VALIDATION,
          action: 'validate',
          proxies: proxies
        })
      } else {
        // Fall back to validating proxies one by one using our utility function
        let completed = 0
        const results: ProxyValidationResult[] = []

        for (const proxyString of proxies) {
          // Parse the proxy string (host:port:username:password)
          const parts = proxyString.split(':')
          const host = parts[0]
          const port = parseInt(parts[1])
          const username = parts[2] || undefined
          const password = parts[3] || undefined

          try {
            const result = await validateProxy(host, port, 'http', username, password)
            
            results.push({
              proxy: proxyString,
              isValid: result.isValid,
              error: result.error,
              // Note: Our utility doesn't return responseTime, so we'll leave it undefined
              // responseTime: result.responseTime,
              // Add other fields as needed
            })
          } catch (error) {
            results.push({
              proxy: proxyString,
              isValid: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }

          completed++
          setProgress((completed / proxies.length) * 100)
          setValidationResults([...results])
        }

        setIsValidating(false)
        
        if (onValidationComplete) {
          onValidationComplete(results)
        }

        // Extract valid proxies
        const validProxies = results
          .filter(result => result.isValid)
          .map(result => result.proxy)

        if (validProxies.length > 0 && onProxiesAdded) {
          onProxiesAdded(validProxies)
        }

        toast({
          title: 'Validation complete',
          description: `${validProxies.length} valid proxies found out of ${results.length} tested`
        })

        // Switch to results tab
        setActiveTab('results')
      }
    } catch (err) {
      setIsValidating(false)
      setError('Failed to start validation')

      toast({
        variant: 'destructive',
        title: 'Validation failed',
        description: 'Could not start proxy validation'
      })
    }
  }, [proxies, wsStatus, send, toast, onValidationComplete, onProxiesAdded])

  // Get badge color based on validation result
  const getValidationBadge = (result: ProxyValidationResult) => {
    if (!result.isValid) {
      return <Badge variant="destructive">Invalid</Badge>
    }

    if (result.anonymityLevel === 'elite') {
      return <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Elite</Badge>
    } else if (result.anonymityLevel === 'anonymous') {
      return <Badge variant="default">Anonymous</Badge>
    } else {
      return <Badge variant="secondary">Transparent</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Proxy Validator</CardTitle>
        <CardDescription>
          Validate and test proxies before adding them to your collection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="input">Input</TabsTrigger>
            <TabsTrigger value="results">
              Results
              {validationResults.length > 0 && (
                <Badge variant="outline" className="ml-2">
                  {validationResults.filter(r => r.isValid).length}/{validationResults.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="space-y-4">
            <Textarea
              placeholder="Enter proxies (one per line, or comma separated)
Format: ip:port or ip:port:username:password"
              value={proxyInput}
              onChange={handleInputChange}
              className="min-h-[200px] font-mono"
            />

            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                {proxies.length} {proxies.length === 1 ? 'proxy' : 'proxies'} detected
                {maxProxies && proxies.length > maxProxies && (
                  <span className="text-red-500 ml-1">
                    (max {maxProxies})
                  </span>
                )}
              </div>

              <Button
                onClick={startValidation}
                disabled={isValidating || proxies.length === 0}
              >
                {isValidating ? (
                  <>
                    <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Validate Proxies'
                )}
              </Button>
            </div>

            {isValidating && (
              <div className="space-y-2">
                <Progress value={progress} />
                <div className="text-xs text-muted-foreground text-right">
                  {Math.round(progress)}% complete
                </div>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <IconAlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="results">
            {isValidating ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8">
                  <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
                <Progress value={progress} />
                <div className="text-xs text-muted-foreground text-center">
                  Validating proxies: {Math.round(progress)}% complete
                </div>
              </div>
            ) : validationResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <IconRefresh className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No validation results yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setActiveTab('input')}
                >
                  Go to Input
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm font-medium mb-2">
                  <div>Proxy</div>
                  <div>Status</div>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {validationResults.map((result, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-2 gap-2 text-sm border-b pb-2"
                    >
                      <div className="font-mono">{result.proxy}</div>
                      <div>
                        <div className="flex items-center gap-2">
                          {result.isValid ? (
                            <IconCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <IconX className="h-4 w-4 text-red-500" />
                          )}
                          {getValidationBadge(result)}
                        </div>

                        {result.isValid ? (
                          <div className="text-xs text-muted-foreground mt-1">
                            {result.responseTime && (
                              <span className="mr-2">{result.responseTime}ms</span>
                            )}
                            {result.country && (
                              <span className="mr-2">{result.country}</span>
                            )}
                            {result.protocol && (
                              <span>{result.protocol.toUpperCase()}</span>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-red-500 mt-1">
                            {result.error || 'Connection failed'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="text-sm">
                    <span className="font-medium">
                      {validationResults.filter(r => r.isValid).length}
                    </span>{' '}
                    valid out of{' '}
                    <span className="font-medium">{validationResults.length}</span> proxies
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab('input')}
                    >
                      Back to Input
                    </Button>

                    <Button
                      size="sm"
                      onClick={startValidation}
                      disabled={isValidating || proxies.length === 0}
                    >
                      Validate Again
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}