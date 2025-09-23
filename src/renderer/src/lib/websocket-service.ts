import { useEffect, useState, useCallback, useRef } from 'react';

// Message types
export enum MessageType {
  // Connection messages
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  AUTH = 'auth',
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',

  // General notifications
  NOTIFICATION = 'notification',
  ALERT = 'alert',
  STATUS_UPDATE = 'status_update',

  // Phone module
  PHONE_SCREEN = 'phone_screen',
  PHONE_CONTROL = 'phone_control',
  PHONE_STATUS = 'phone_status',
  PHONE_NOTIFICATION = 'phone_notification',
  PHONE_ACTIVITY = 'phone_activity',

  // Profile module
  PROFILE_UPDATE = 'profile_update',
  PROFILE_STATUS = 'profile_status',
  PROFILE_ACTIVITY = 'profile_activity',

  // Proxy module
  PROXY_STATUS = 'proxy_status',
  PROXY_METRICS = 'proxy_metrics',
  PROXY_VALIDATION = 'proxy_validation',
  PROXY_ACTIVITY = 'proxy_activity',

  // Number module
  NUMBER_SMS = 'number_sms',
  NUMBER_CALL = 'number_call',
  NUMBER_VERIFICATION = 'number_verification',
  NUMBER_STATUS = 'number_status',
  NUMBER_ACTIVITY = 'number_activity',

  // Crawler module
  CRAWLER_STATUS = 'crawler_status',
  CRAWLER_PROGRESS = 'crawler_progress',
  CRAWLER_RESULT = 'crawler_result',
  CRAWLER_ACTIVITY = 'crawler_activity',

  // Scraper module
  SCRAPER_STATUS = 'scraper_status',
  SCRAPER_PROGRESS = 'scraper_progress',
  SCRAPER_RESULT = 'scraper_result',
  SCRAPER_ACTIVITY = 'scraper_activity'
}

// WebSocket connection status
export enum ConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

// WebSocket message
export interface WebSocketMessage {
  type: MessageType;
  [key: string]: any;
}

// WebSocket options
export interface WebSocketOptions {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  debug?: boolean;
}

// WebSocket service
export class WebSocketService {
  private socket: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageHandlers: Map<MessageType, ((message: WebSocketMessage) => void)[]> = new Map();
  private statusHandlers: ((status: ConnectionStatus) => void)[] = [];
  private options: WebSocketOptions;

  constructor(url: string, options: WebSocketOptions = {}) {
    this.url = url;
    this.options = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      pingInterval: 30000,
      debug: false,
      ...options,
    };
  }

  // Connect to WebSocket server
  public connect(token?: string): void {
    if (token) {
      this.token = token;
    }

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      this.log('WebSocket already connected or connecting');
      return;
    }

    this.setStatus(ConnectionStatus.CONNECTING);

    // Build URL with token
    const wsUrl = this.token ? `${this.url}?token=${this.token}` : this.url;

    try {
      this.socket = new WebSocket(wsUrl);

      // Set up event handlers
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      this.log('Error creating WebSocket:', error);
      this.setStatus(ConnectionStatus.ERROR);
      this.scheduleReconnect();
    }
  }

  // Disconnect from WebSocket server
  public disconnect(): void {
    this.clearReconnectTimeout();
    this.clearPingInterval();

    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;

      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.close();
      }

      this.socket = null;
    }

    this.setStatus(ConnectionStatus.DISCONNECTED);
  }

  // Send message to WebSocket server
  public send(message: WebSocketMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.log('Cannot send message, WebSocket not connected');
      return false;
    }

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      this.log('Error sending message:', error);
      return false;
    }
  }

  // Add message handler
  public on(type: MessageType, handler: (message: WebSocketMessage) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }

    this.messageHandlers.get(type)?.push(handler);
  }

  // Remove message handler
  public off(type: MessageType, handler: (message: WebSocketMessage) => void): void {
    if (!this.messageHandlers.has(type)) {
      return;
    }

    const handlers = this.messageHandlers.get(type) || [];
    const index = handlers.indexOf(handler);

    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  // Add status handler
  public onStatusChange(handler: (status: ConnectionStatus) => void): void {
    this.statusHandlers.push(handler);
    // Immediately call with current status
    handler(this.status);
  }

  // Remove status handler
  public offStatusChange(handler: (status: ConnectionStatus) => void): void {
    const index = this.statusHandlers.indexOf(handler);

    if (index !== -1) {
      this.statusHandlers.splice(index, 1);
    }
  }

  // Get current connection status
  public getStatus(): ConnectionStatus {
    return this.status;
  }

  // Send ping message
  public ping(): void {
    this.send({
      type: MessageType.PING,
      timestamp: Date.now(),
    });
  }

  // Handle WebSocket open event
  private handleOpen(event: Event): void {
    this.log('WebSocket connected');
    this.setStatus(ConnectionStatus.CONNECTED);
    this.reconnectAttempts = 0;

    // Start ping interval
    this.startPingInterval();
  }

  // Handle WebSocket message event
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;
      this.log('Received message:', message);

      // Call message handlers
      const handlers = this.messageHandlers.get(message.type) || [];
      handlers.forEach((handler) => {
        try {
          handler(message);
        } catch (error) {
          this.log('Error in message handler:', error);
        }
      });
    } catch (error) {
      this.log('Error parsing message:', error);
    }
  }

  // Handle WebSocket close event
  private handleClose(event: CloseEvent): void {
    this.log(`WebSocket closed: ${event.code} ${event.reason}`);
    this.setStatus(ConnectionStatus.DISCONNECTED);
    this.clearPingInterval();
    this.scheduleReconnect();
  }

  // Handle WebSocket error event
  private handleError(event: Event): void {
    this.log('WebSocket error:', event);
    this.setStatus(ConnectionStatus.ERROR);
  }

  // Set connection status
  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusHandlers.forEach((handler) => {
        try {
          handler(status);
        } catch (error) {
          this.log('Error in status handler:', error);
        }
      });
    }
  }

  // Schedule reconnect
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.reconnectAttempts >= (this.options.maxReconnectAttempts || 5)) {
      this.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;

    const delay = (this.options.reconnectInterval || 3000) * Math.pow(1.5, this.reconnectAttempts - 1);
    this.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.log(`Attempting to reconnect (${this.reconnectAttempts})`);
      this.connect();
    }, delay);
  }

  // Clear reconnect timeout
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // Start ping interval
  private startPingInterval(): void {
    this.clearPingInterval();

    if (this.options.pingInterval) {
      this.pingInterval = setInterval(() => {
        this.ping();
      }, this.options.pingInterval);
    }
  }

  // Clear ping interval
  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // Log message if debug is enabled
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[WebSocketService]', ...args);
    }
  }
}

// React hook for using WebSocket service
export function useWebSocket(url: string, options: WebSocketOptions = {}) {
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const serviceRef = useRef<WebSocketService | null>(null);

  // Initialize WebSocket service
  useEffect(() => {
    if (!serviceRef.current) {
      serviceRef.current = new WebSocketService(url, options);
    }

    const service = serviceRef.current;

    // Handle status changes
    service.onStatusChange(setStatus);

    return () => {
      service.offStatusChange(setStatus);
    };
  }, [url, options]);

  // Connect to WebSocket server
  const connect = useCallback((token?: string) => {
    serviceRef.current?.connect(token);
  }, []);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    serviceRef.current?.disconnect();
  }, []);

  // Send message to WebSocket server
  const send = useCallback((message: WebSocketMessage) => {
    return serviceRef.current?.send(message) || false;
  }, []);

  // Add message handler
  const on = useCallback((type: MessageType, handler: (message: WebSocketMessage) => void) => {
    serviceRef.current?.on(type, handler);
  }, []);

  // Remove message handler
  const off = useCallback((type: MessageType, handler: (message: WebSocketMessage) => void) => {
    serviceRef.current?.off(type, handler);
  }, []);

  return {
    status,
    connect,
    disconnect,
    send,
    on,
    off,
  };
}

// Create a singleton instance for global use
let globalService: WebSocketService | null = null;

export function getWebSocketService(url?: string, options?: WebSocketOptions): WebSocketService {
  if (!globalService && url) {
    globalService = new WebSocketService(url, options);
  }

  if (!globalService) {
    throw new Error('WebSocketService not initialized');
  }

  return globalService;
}
