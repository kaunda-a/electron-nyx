/**
 * Utility for parsing and formatting proxy URLs
 * This handles various proxy URL formats and ensures consistent handling
 */

export interface ParsedProxyUrl {
  protocol: string;
  host: string;
  port: string;
  username?: string;
  password?: string;
}

/**
 * Parse a proxy URL into its components
 * 
 * Handles various formats:
 * - protocol://host:port
 * - protocol://username:password@host:port
 * - host:port
 * - username:password@host:port
 * - host:port:username:password (NodeMaven format)
 */
export function parseProxyUrl(url: string): ParsedProxyUrl | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  url = url.trim();
  
  // Default values
  const defaultResult: ParsedProxyUrl = {
    protocol: 'http',
    host: '',
    port: '8080'
  };

  try {
    // Check if the URL has a protocol
    if (url.includes('://')) {
      // It has a protocol, try to parse it as a URL
      const parsedUrl = new URL(url);
      
      // Extract protocol (remove the trailing colon)
      const protocol = parsedUrl.protocol.replace(':', '');
      
      // Extract host and port
      const host = parsedUrl.hostname;
      const port = parsedUrl.port || (protocol === 'http' ? '80' : protocol === 'https' ? '443' : '1080');
      
      // Extract username and password if present
      const username = parsedUrl.username || undefined;
      const password = parsedUrl.password || undefined;
      
      return { protocol, host, port, username, password };
    } else {
      // No protocol, check if it has authentication
      let hostPart = url;
      let username: string | undefined;
      let password: string | undefined;
      
      if (url.includes('@')) {
        const parts = url.split('@');
        if (parts.length === 2) {
          const authParts = parts[0].split(':');
          if (authParts.length === 2) {
            username = authParts[0];
            password = authParts[1];
          }
          hostPart = parts[1];
        }
      } else if (url.split(':').length === 4) {
        // NodeMaven format: host:port:username:password
        const parts = url.split(':');
        if (parts.length === 4) {
          return {
            protocol: 'http',
            host: parts[0],
            port: parts[1],
            username: parts[2],
            password: parts[3]
          };
        }
      }
      
      // Parse host:port
      const hostPortParts = hostPart.split(':');
      if (hostPortParts.length === 2) {
        const host = hostPortParts[0];
        const port = hostPortParts[1];
        
        return {
          protocol: 'http', // Default protocol
          host,
          port,
          username,
          password
        };
      } else if (hostPortParts.length === 1) {
        // Just a host, use default port
        return {
          protocol: 'http',
          host: hostPortParts[0],
          port: '8080', // Default port
          username,
          password
        };
      }
    }
  } catch (error) {
    console.error('Error parsing proxy URL:', error);
  }
  
  return null;
}

/**
 * Format proxy components into a URL string
 * 
 * @param protocol The proxy protocol (http, https, socks4, socks5)
 * @param host The proxy host
 * @param port The proxy port
 * @param username Optional username for authentication
 * @param password Optional password for authentication
 * @param includeProtocol Whether to include the protocol in the URL
 * @returns Formatted proxy URL
 */
export function formatProxyUrl(
  protocol: string,
  host: string,
  port: string,
  username?: string,
  password?: string,
  includeProtocol: boolean = true
): string {
  if (!host) return '';
  
  // Authentication part
  const authPart = username && password ? `${username}:${password}@` : '';
  
  // Protocol part (only if requested)
  const protocolPart = includeProtocol ? `${protocol}://` : '';
  
  // Host and port
  const hostPortPart = `${host}:${port}`;
  
  return `${protocolPart}${authPart}${hostPortPart}`;
}

/**
 * Format proxy components into a server string for the backend
 * 
 * This function creates the server string that will be sent to the backend.
 * The backend expects a string in a format it can parse with a simple split(':').
 * 
 * @param host The proxy host
 * @param port The proxy port
 * @returns Formatted proxy server string (host:port)
 */
export function formatProxyServer(host: string, port: string): string {
  if (!host) return '';
  
  // Only add port if it exists
  const portPart = port ? `:${port}` : '';
  
  // For the server, we need to send just the host:port without the protocol
  // This is because the server code splits by ':' and expects only 2 parts
  return `${host}${portPart}`;
}
