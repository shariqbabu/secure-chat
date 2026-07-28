/**
 * WebSocket client for real-time messaging
 * Handles connection, reconnection, and message routing
 */

import type {
  WebSocketMessage,
  WSMessagePayload,
  WSTypingPayload,
  WSReadReceiptPayload,
  WSFriendRequestPayload,
} from '@shared/types/api';

type MessageHandler = (payload: unknown) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private messageQueue: WebSocketMessage[] = [];
  private isConnected = false;
  private heartbeatInterval: number | null = null;

  constructor(url: string) {
    this.url = url;
  }

  setToken(token: string) {
    this.token = token;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    const wsUrl = this.token ? `${this.url}?token=${this.token}` : this.url;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.stopHeartbeat();
      this.attemptReconnect();
    };
  }

  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected) {
        this.send({
          type: 'ping',
          payload: {},
          timestamp: new Date(),
        });
      }
    }, 30000); // Every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleMessage(message: WebSocketMessage) {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message.payload));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  send(message: WebSocketMessage) {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  // Convenience methods for specific message types
  sendMessage(payload: WSMessagePayload) {
    this.send({
      type: 'message',
      payload,
      timestamp: new Date(),
    });
  }

  sendTyping(payload: WSTypingPayload) {
    this.send({
      type: 'typing',
      payload,
      timestamp: new Date(),
    });
  }

  sendReadReceipt(payload: WSReadReceiptPayload) {
    this.send({
      type: 'read_receipt',
      payload,
      timestamp: new Date(),
    });
  }

  updateOnlineStatus(online: boolean) {
    this.send({
      type: 'online_status',
      payload: { online, lastSeen: new Date() },
      timestamp: new Date(),
    });
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8787/ws';
export const wsClient = new WebSocketClient(wsUrl);
export default wsClient;
