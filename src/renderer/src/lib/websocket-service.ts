import { useEffect, useState } from 'react';

// Define message types
export enum MessageType {
  PROXY_VALIDATION = 'proxy_validation',
  SYSTEM_STATUS = 'system_status',
  PROFILE_UPDATE = 'profile_update',
  CAMPAIGN_UPDATE = 'campaign_update',
}

// Define connection status
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

// WebSocket configuration options
interface WebSocketOptions {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  debug?: boolean;
}

// WebSocket service interface
interface WebSocketService {
  status: ConnectionStatus;
  connect: (authToken?: string) => void;
  disconnect: () => void;
  send: (message: any) => void;
  on: (type: MessageType, handler: (message: any) => void) => void;
  off: (type: MessageType, handler: (message: any) => void) => void;
}

/**
 * Custom hook for managing WebSocket connections
 */
export function useWebSocket(
  url: string,
  options: WebSocketOptions = {}
): WebSocketService {
  const {
    reconnectInterval = 2000,
    maxReconnectAttempts = 5,
    pingInterval = 30000,
    debug = false
  } = options;

  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Message handlers by type
  const messageHandlers = useState<Map<MessageType, Set<(message: any) => void>>>(() => new Map())[0];

  // Initialize WebSocket
  const connect = (authToken?: string) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      return;
    }

    let connectUrl = url;
    if (authToken) {
      connectUrl = `${url}${url.includes('?') ? '&' : '?'}token=${authToken}`;
    }

    try {
      const newWs = new WebSocket(connectUrl);
      setWs(newWs);
      setStatus(ConnectionStatus.CONNECTING);

      newWs.onopen = () => {
        setStatus(ConnectionStatus.CONNECTED);
        setReconnectAttempts(0);
        if (debug) console.log('WebSocket connected');
      };

      newWs.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          // Handle ping messages
          if (message.type === 'ping') {
            newWs.send(JSON.stringify({ type: 'pong' }));
            return;
          }

          // Call specific message handlers
          if (message.type && messageHandlers.has(message.type)) {
            const handlers = messageHandlers.get(message.type);
            if (handlers) {
              handlers.forEach(handler => handler(message));
            }
          }

          // Log for debugging
          if (debug) {
            console.log('Received message:', message);
          }
        } catch (error) {
          if (debug) {
            console.error('Error parsing message:', error);
          }
        }
      };

      newWs.onclose = () => {
        setStatus(ConnectionStatus.DISCONNECTED);
        if (debug) console.log('WebSocket disconnected');

        // Attempt to reconnect if not at max attempts
        if (reconnectAttempts < maxReconnectAttempts) {
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect(authToken);
          }, reconnectInterval);
        }
      };

      newWs.onerror = (error) => {
        setStatus(ConnectionStatus.ERROR);
        if (debug) {
          console.error('WebSocket error:', error);
        }
      };
    } catch (error) {
      setStatus(ConnectionStatus.ERROR);
      if (debug) {
        console.error('Failed to create WebSocket connection:', error);
      }
    }
  };

  // Disconnect WebSocket
  const disconnect = () => {
    if (ws) {
      ws.close();
      setWs(null);
      setStatus(ConnectionStatus.DISCONNECTED);
      if (debug) console.log('WebSocket disconnected');
    }
  };

  // Send message
  const send = (message: any) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      if (debug) {
        console.log('Sent message:', message);
      }
    } else {
      if (debug) {
        console.warn('WebSocket not connected, unable to send message:', message);
      }
    }
  };

  // Subscribe to message type
  const on = (type: MessageType, handler: (message: any) => void) => {
    if (!messageHandlers.has(type)) {
      messageHandlers.set(type, new Set());
    }
    
    const handlers = messageHandlers.get(type);
    if (handlers) {
      handlers.add(handler);
    }
  };

  // Unsubscribe from message type
  const off = (type: MessageType, handler: (message: any) => void) => {
    if (messageHandlers.has(type)) {
      const handlers = messageHandlers.get(type);
      if (handlers) {
        handlers.delete(handler);
      }
    }
  };

  // Set up ping/pong keep-alive
  useEffect(() => {
    let pingIntervalId: NodeJS.Timeout;

    if (status === ConnectionStatus.CONNECTED) {
      pingIntervalId = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, pingInterval);
    }

    return () => {
      if (pingIntervalId) {
        clearInterval(pingIntervalId);
      }
    };
  }, [status, ws, pingInterval]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [ws]);

  return {
    status,
    connect,
    disconnect,
    send,
    on,
    off
  };
}

export default useWebSocket;