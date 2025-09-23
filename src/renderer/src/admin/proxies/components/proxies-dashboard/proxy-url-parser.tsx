import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { parseProxyUrl } from '../../utils/proxy-url-parser'

interface ProxyUrlParserProps {
  onParse: (parsedData: {
    protocol: 'http' | 'https' | 'socks4' | 'socks5'
    host: string
    port: string
    username?: string
    password?: string
  }) => void
}

export function ProxyUrlParser({ onParse }: ProxyUrlParserProps) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleParseProxyUrl = () => {
    setError(null)

    try {
      // Use our utility function to parse the URL
      const parsedProxy = parseProxyUrl(url)

      if (!parsedProxy) {
        setError('Invalid proxy URL format. Expected: protocol://[username:password@]host:port or host:port')
        return
      }

      // Validate protocol
      if (!['http', 'https', 'socks4', 'socks5'].includes(parsedProxy.protocol.toLowerCase())) {
        setError('Protocol must be one of: http, https, socks4, socks5')
        return
      }

      // Validate port
      const portNum = parseInt(parsedProxy.port, 10)
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        setError('Port must be a number between 1 and 65535')
        return
      }

      // Call the onParse callback with the parsed data
      onParse({
        protocol: parsedProxy.protocol.toLowerCase() as 'http' | 'https' | 'socks4' | 'socks5',
        host: parsedProxy.host,
        port: parsedProxy.port,
        ...(parsedProxy.username && { username: parsedProxy.username }),
        ...(parsedProxy.password && { password: parsedProxy.password })
      })

      // Clear the input after successful parsing
      setUrl('')
    } catch (err) {
      setError('Failed to parse proxy URL. Please check the format and try again.')
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Add Proxy</CardTitle>
        <CardDescription>
          Paste a proxy URL to automatically fill the form fields
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <Label htmlFor="proxy-url">Proxy URL</Label>
          <div className="flex gap-2">
            <Input
              id="proxy-url"
              placeholder="protocol://username:password@host:port"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleParseProxyUrl}
              disabled={!url.trim()}
              size="sm"
            >
              Parse <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            <p>Supported formats:</p>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>http://user:pass@proxy.example.com:8080</li>
              <li>proxy.example.com:8080 (defaults to HTTP)</li>
              <li>user:pass@proxy.example.com:8080 (defaults to HTTP)</li>
            </ul>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="pt-1 text-xs text-muted-foreground">
        <div>
          <p><strong>Supported protocols:</strong> HTTP, HTTPS, SOCKS4, SOCKS5</p>
          <p className="mt-1"><strong>Note:</strong> For SOCKS5 proxies, authentication may not be supported by all browsers.</p>
        </div>
      </CardFooter>
    </Card>
  )
}
