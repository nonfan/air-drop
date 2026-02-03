import { io, Socket } from 'socket.io-client';
import { EventEmitter } from 'events';

export interface TransportConfig {
  url: string;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

export class UnifiedTransportService extends EventEmitter {
  private socket: Socket | null = null;
  private config: TransportConfig;
  private isConnecting = false;

  constructor(config: TransportConfig) {
    super();
    this.config = {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      ...config
    };
  }

  async connect(): Promise<void> {
    if (this.socket?.connected) {
      return;
    }

    if (this.isConnecting) {
      throw new Error('Connection already in progress');
    }

    this.isConnecting = true;

    try {
      this.socket = io(this.config.url, {
        reconnection: this.config.reconnection,
        reconnectionAttempts: this.config.reconnectionAttempts,
        reconnectionDelay: this.config.reconnectionDelay,
        transports: ['websocket', 'polling']
      });

      await this.waitForConnection();
      this.setupEventHandlers();
      this.emit('connected');
    } finally {
      this.isConnecting = false;
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.emit('disconnected');
    }
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  send(event: string, data?: any): void {
    if (!this.socket?.connected) {
      throw new Error('Not connected');
    }
    this.socket.emit(event, data);
  }

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.socket) {
      throw new Error('Socket not initialized');
    }
    this.socket.on(event, handler);
  }

  off(event: string, handler?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, handler);
    }
  }

  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket!.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      this.emit('disconnected', reason);
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.emit('reconnected', attemptNumber);
    });

    this.socket.on('reconnect_error', (error) => {
      this.emit('reconnect_error', error);
    });

    this.socket.on('error', (error) => {
      this.emit('error', error);
    });
  }
}
