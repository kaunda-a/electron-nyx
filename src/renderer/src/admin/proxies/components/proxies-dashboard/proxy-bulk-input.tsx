import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Check, Clipboard, Loader2, Info } from 'lucide-react'
import { identifyProxy, getProxyTypeLabel, getProxyTypeColor, ProxyType } from '../../utils/proxy-identifier'
import { parseProxyUrl, formatProxyServer } from '../../utils/proxy-url-parser'
import { validateProxy } from '../../utils/proxy-validator'

// Supported formats for auto-detection
type FormatParser = {
  name: string;
  regex: RegExp;
  parse: (match: RegExpMatchArray) => {
    host: string;
    port: string;
    username?: string;
    password?: string;
    protocol?: string;
  };
};

const FORMATS: FormatParser[] = [
  // URI Format: protocol://[username:password@]host:port
  {
    name: 'URI Format',
    regex: /^(https?|socks[45]):\/\/(?:([^:@\s]+)(?::([^@\s]+))?@)?([^:@\s]+):(\d+)\/?$/i,
    parse: (match: RegExpMatchArray) => {
      const [, protocol, username, password, host, port] = match;
      return {
        host,
        port,
        username: username || undefined,
        password: password || undefined,
        protocol: protocol.toLowerCase(),
      };
    }
  },
  // Standard format: host:port:username:password or host:port
  {
    name: 'Standard',
    regex: /^([^:\s]+):(\d+)(?::([^:\s]+)(?::([^:\s]+))?)?$/,
    parse: (match: RegExpMatchArray) => {
      const [, host, port, username, password] = match;
      return {
        host,
        port,
        username: username || undefined,
        password: password || undefined,
      };
    }
  },
  // Provider-specific formats (BrightData, SmartProxy, Oxylabs, etc.)
  {
    name: 'Provider Format',
    regex: /^([^:\s]+):(\d+):([^:\s]+):([^:\s]+)$/,
    parse: (match: RegExpMatchArray) => {
      const [, host, port, username, password] = match;
      return {
        host,
        port,
        username: username || undefined,
        password: password || undefined,
      };
    }
  },
];

interface ParsedProxy {
  host: string;
  port: string;
  username?: string;
  password?: string;
  protocol?: string;
  type?: ProxyType;
  provider?: string;
  valid: boolean;
  error?: string;
  line: number;
  raw: string;
}

interface ProxyBulkInputProps {
  onParse: (proxies: ParsedProxy[]) => void;
  onAddStart?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
}

export function ProxyBulkInput({ onAddStart, onCancel, isLoading }: ProxyBulkInputProps) {
  const [inputText, setInputText] = useState('');
  const [parsedProxies, setParsedProxies] = useState<ParsedProxy[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<Record<string, { isValid: boolean; error?: string }>>({});
  const { toast } = useToast();
  
  // Flag to prevent repeated error notifications
  const [apiErrorShown, setApiErrorShown] = useState(false);

  // Reset API error flag when input changes
  React.useEffect(() => {
    setApiErrorShown(false);
  }, [inputText]);

  const parseProxies = () => {
    setError(null)
    setIsParsing(true)

    try {
      const lines = input.split('\n').filter(line => line.trim() !== '')
      const parsed: ParsedProxy[] = []

      if (lines.length === 0) {
        setError('No proxies found in input')
        setIsParsing(false)
        return
      }

      // Process each line and auto-detect format
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        // Try to parse using our utility first
        const parsedUrl = parseProxyUrl(line)

        if (parsedUrl) {
          // Successfully parsed with our utility
          const proxy: ParsedProxy = {
            host: parsedUrl.host,
            port: parsedUrl.port,
            username: parsedUrl.username,
            password: parsedUrl.password,
            protocol: parsedUrl.protocol,
            valid: true,
            line: i + 1,
            raw: line,
          }

          // Identify proxy type and provider
          const identification = identifyProxy(proxy.host, parseInt(proxy.port), proxy.username)
          proxy.type = identification.type
          proxy.provider = identification.provider

          parsed.push(proxy)
          continue
        }

        // If our utility failed, try the legacy formats
        let proxyParsed = false
        for (const format of FORMATS) {
          const match = line.match(format.regex)
          if (match) {
            // Parse the proxy using the format's parse function
            const proxyData = format.parse(match)

            const proxy: ParsedProxy = {
              ...proxyData,
              valid: true,
              line: i + 1,
              raw: line,
            }

            // Identify proxy type and provider
            const identification = identifyProxy(proxy.host, parseInt(proxy.port), proxy.username)
            proxy.type = identification.type
            proxy.provider = identification.provider

            parsed.push(proxy)
            proxyParsed = true
            break
          }
        }

        // If no format matched, add as invalid
        if (!proxyParsed && !parsedUrl) {
          parsed.push({
            host: '',
            port: '',
            valid: false,
            error: 'Could not parse proxy format',
            line: i + 1,
            raw: line,
          })
        }
      }

      setParsedProxies(parsed)

      // Check if we have any valid proxies
      const validProxies = parsed.filter(p => p.valid)
      if (validProxies.length === 0) {
        setError('No valid proxies found. Please check the format and try again.')
      } else if (validProxies.length < parsed.length) {
        setError(`Parsed ${validProxies.length} out of ${parsed.length} proxies. Some lines could not be parsed.`)
      }

    } catch (err) {
      setError('Failed to parse proxies: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsParsing(false)
    }
  }

  const validateProxies = async () => {
    // Check if proxy validation API is available before proceeding
    if (typeof window === 'undefined' || !window.api || !window.api.proxies) {
      // Only show error once to prevent spam
      if (!apiErrorShown) {
        setError('Proxy validation service is not available. Please ensure the application is properly initialized.');
        console.log('Proxy validation service not available:', {
          windowExists: typeof window !== 'undefined',
          apiExists: typeof window !== 'undefined' && !!window.api,
          proxiesExists: typeof window !== 'undefined' && !!window.api && !!window.api.proxies,
          validateExists: typeof window !== 'undefined' && !!window.api && !!window.api.proxies && !!window.api.proxies.validate
        });
        setApiErrorShown(true);
      }
      return;
    }

    if (!window.api.proxies.validate) {
      // Only show error once to prevent spam
      if (!apiErrorShown) {
        setError('Proxy validation service is not available. Please ensure the application is properly initialized.');
        console.log('Proxy validation service validate method not available:', window.api.proxies);
        setApiErrorShown(true);
      }
      return;
    }

    setIsValidating(true)
    setError(null)
    setValidationResults({})

    try {
      const validProxies = parsedProxies.filter(p => p.valid)
      const results: Record<string, { isValid: boolean; error?: string }> = {}

      for (let i = 0; i < validProxies.length; i++) {
        const proxy = validProxies[i]
        const key = `${proxy.host}:${proxy.port}:${proxy.username || ''}:${proxy.password || ''}`
        
        try {
          // Update progress
          const progress = Math.round(((i + 1) / validProxies.length) * 100)
          // You could add a progress callback here if needed

          const result = await validateProxy(
            proxy.host,
            parseInt(proxy.port),
            proxy.protocol || 'http',
            proxy.username,
            proxy.password
          )
          
          results[key] = {
            isValid: result.isValid,
            error: result.error
          }
          
          // Update state to show progress
          setValidationResults({...results})
        } catch (error) {
          results[key] = {
            isValid: false,
            error: error instanceof Error ? error.message : 'Validation failed'
          }
          // Update state to show progress
          setValidationResults({...results})
        }
      }

      // Final update
      setValidationResults(results)
    } catch (err) {
      setError('Failed to validate proxies: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setIsValidating(false)
    }
  }

  const handleSubmit = () => {
    const validProxies = parsedProxies.filter(p => p.valid)
    if (onAddStart) {
      onAddStart()
    }
    onParse(validProxies)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInput(text)
    } catch (err) {
      setError('Failed to paste from clipboard. Please paste manually.')
    }
  }

  // Check if all valid proxies have been validated and are valid
  const allValidProxiesValidated = () => {
    const validProxies = parsedProxies.filter(p => p.valid)
    if (validProxies.length === 0) return false
    
    return validProxies.every(proxy => {
      const key = `${proxy.host}:${proxy.port}:${proxy.username || ''}:${proxy.password || ''}`
      return validationResults[key] && validationResults[key].isValid
    })
  }

  // Check if any proxy has failed validation
  const hasFailedValidation = () => {
    return Object.values(validationResults).some(result => !result.isValid)
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted/50 p-4 rounded-lg border">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h4 className="text-sm font-medium mb-1">Supported Formats (Auto-detected)</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li><span className="font-mono">protocol://username:password@host:port</span> - URI format</li>
              <li><span className="font-mono">username:password@host:port</span> - Auth format (defaults to HTTP)</li>
              <li><span className="font-mono">host:port</span> - Simple format (defaults to HTTP)</li>
              <li><span className="font-mono">host:port:username:password</span> - Standard format</li>
              <li>Provider formats (BrightData, SmartProxy, Oxylabs, etc.)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="proxies">Paste your proxies (one per line)</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePaste}
            className="h-8 gap-1"
          >
            <Clipboard className="h-3.5 w-3.5" />
            <span>Paste</span>
          </Button>
        </div>
        <Textarea
          id="proxies"
          placeholder="Paste your proxies here, one per line"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="font-mono h-[200px]"
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {parsedProxies.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Parsed Proxies</CardTitle>
            <CardDescription>
              {parsedProxies.filter(p => p.valid).length} valid proxies found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[200px] overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Line</th>
                    <th className="text-left p-2">Host:Port</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Provider</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedProxies.map((proxy, index) => {
                    const key = `${proxy.host}:${proxy.port}:${proxy.username || ''}:${proxy.password || ''}`
                    const validationResult = validationResults[key]
                    
                    return (
                      <tr key={index} className={proxy.valid ? '' : 'bg-red-50 dark:bg-red-900/20'}>
                        <td className="p-2">{proxy.line}</td>
                        <td className="p-2 font-mono">
                          {proxy.valid ? `${proxy.host}:${proxy.port}` : '—'}
                        </td>
                        <td className="p-2">
                          {proxy.type && (
                            <Badge variant="outline" className={getProxyTypeColor(proxy.type)}>
                              {getProxyTypeLabel(proxy.type)}
                            </Badge>
                          )}
                        </td>
                        <td className="p-2">{proxy.provider || '—'}</td>
                        <td className="p-2">
                          {validationResult ? (
                            validationResult.isValid ? (
                              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                                <Check className="mr-1 h-3 w-3" /> Valid
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                                <AlertCircle className="mr-1 h-3 w-3" /> Invalid
                              </Badge>
                            )
                          ) : proxy.valid ? (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                              Not validated
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                              <AlertCircle className="mr-1 h-3 w-3" /> {proxy.error}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={validateProxies}
                disabled={parsedProxies.filter(p => p.valid).length === 0 || isValidating}
              >
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating... ({Object.keys(validationResults).length}/{parsedProxies.filter(p => p.valid).length})
                  </>
                ) : (
                  'Validate Proxies'
                )}
              </Button>
              <Button
                onClick={() => {
                  const validProxies = parsedProxies.filter(p => p.valid)
                  if (onAddStart) {
                    onAddStart()
                  }
                  onParse(validProxies)
                }}
                disabled={parsedProxies.filter(p => p.valid).length === 0 || !allValidProxiesValidated() || hasFailedValidation() || isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  `Add ${parsedProxies.filter(p => p.valid).length} Proxies`
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      <div className="flex justify-between">
        {!parsedProxies.length && onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {!parsedProxies.length && (
          <Button
            onClick={parseProxies}
            disabled={!input.trim() || isParsing}
            className="ml-auto"
          >
            {isParsing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing...
              </>
            ) : (
              'Parse Proxies'
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
