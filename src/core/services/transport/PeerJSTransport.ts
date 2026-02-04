import Peer, { DataConnection } from 'peerjs';
import { EventEmitter } from 'events';

export interface PeerConfig {
  peerId?: string;
  host?: string;
  port?: number;
  path?: string;
  secure?: boolean;
}

export interface FileChunk {
  type: 'file-chunk';
  transferId: string;
  index: number;
  total: number;
  data: ArrayBuffer;
}

export interface TransferMetadata {
  type: 'transfer-request' | 'transfer-accept' | 'transfer-reject' | 'transfer-complete';
  transferId: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
}

/**
 * PeerJS 传输层
 * 提供 P2P 直连文件传输能力
 */
export class PeerJSTransport extends EventEmitter {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private peerId: string = '';
  private config: PeerConfig;

  constructor(config: PeerConfig = {}) {
    super();
    this.config = config;
  }

  /**
   * 连接到 PeerServer
   */
  async connect(): Promise<void> {
    if (this.peer) {
      console.warn('[PeerJS] Already connected');
      return;
    }

    this.peer = new Peer(this.config.peerId, {
      host: this.config.host || 'localhost',
      port: this.config.port || 9000,
      path: this.config.path || '/peerjs',
      secure: this.config.secure || false,
      debug: 2, // 开启调试日志
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    });

    await this.waitForOpen();
    this.setupEventHandlers();
    
    console.log('[PeerJS] Connected with ID:', this.peerId);
    this.emit('connected', this.peerId);
  }

  /**
   * 连接到远程 Peer
   */
  async connectToPeer(remotePeerId: string): Promise<void> {
    if (!this.peer) {
      throw new Error('Peer not initialized');
    }

    if (this.connections.has(remotePeerId)) {
      console.log('[PeerJS] Already connected to:', remotePeerId);
      return;
    }

    console.log('[PeerJS] Connecting to peer:', remotePeerId);

    const conn = this.peer.connect(remotePeerId, {
      reliable: true,
      serialization: 'binary'
    });

    await this.waitForConnection(conn);
    this.connections.set(remotePeerId, conn);
    this.setupConnectionHandlers(conn);
    
    console.log('[PeerJS] Connected to peer:', remotePeerId);
    this.emit('peer-connected', remotePeerId);
  }

  /**
   * 发送普通数据
   */
  send(peerId: string, data: any): void {
    const conn = this.connections.get(peerId);
    if (!conn || !conn.open) {
      throw new Error(`Not connected to peer: ${peerId}`);
    }
    conn.send(data);
  }

  /**
   * 发送文件
   */
  async sendFile(peerId: string, file: File, transferId: string): Promise<void> {
    const conn = this.connections.get(peerId);
    if (!conn || !conn.open) {
      throw new Error(`Not connected to peer: ${peerId}`);
    }

    const chunkSize = 16 * 1024; // 16KB chunks
    const chunks = Math.ceil(file.size / chunkSize);

    console.log(`[PeerJS] Sending file: ${file.name} (${file.size} bytes, ${chunks} chunks)`);

    for (let i = 0; i < chunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      const buffer = await chunk.arrayBuffer();

      const chunkData: FileChunk = {
        type: 'file-chunk',
        transferId,
        index: i,
        total: chunks,
        data: buffer
      };

      conn.send(chunkData);

      // 发送进度事件
      this.emit('send-progress', {
        transferId,
        sent: end,
        total: file.size,
        percent: Math.round((end / file.size) * 100)
      });

      // 避免发送过快导致缓冲区溢出
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    console.log('[PeerJS] File sent successfully');
  }

  /**
   * 获取当前 Peer ID
   */
  getPeerId(): string {
    return this.peerId;
  }

  /**
   * 获取所有连接的 Peer
   */
  getConnectedPeers(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * 检查是否已连接到指定 Peer
   */
  isConnectedTo(peerId: string): boolean {
    const conn = this.connections.get(peerId);
    return conn ? conn.open : false;
  }

  /**
   * 断开与指定 Peer 的连接
   */
  disconnectPeer(peerId: string): void {
    const conn = this.connections.get(peerId);
    if (conn) {
      conn.close();
      this.connections.delete(peerId);
      console.log('[PeerJS] Disconnected from peer:', peerId);
    }
  }

  /**
   * 断开所有连接
   */
  disconnect(): void {
    console.log('[PeerJS] Disconnecting...');
    
    this.connections.forEach(conn => conn.close());
    this.connections.clear();
    
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    
    this.emit('disconnected');
  }

  /**
   * 等待 Peer 连接到服务器
   */
  private waitForOpen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.peer!.on('open', (id) => {
        clearTimeout(timeout);
        this.peerId = id;
        resolve();
      });

      this.peer!.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 等待与远程 Peer 的连接建立
   */
  private waitForConnection(conn: DataConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      conn.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * 设置 Peer 事件处理器
   */
  private setupEventHandlers(): void {
    if (!this.peer) return;

    // 监听传入连接
    this.peer.on('connection', (conn) => {
      console.log('[PeerJS] Incoming connection from:', conn.peer);
      
      conn.on('open', () => {
        this.connections.set(conn.peer, conn);
        this.setupConnectionHandlers(conn);
        this.emit('peer-connected', conn.peer);
      });
    });

    // 监听断开连接
    this.peer.on('disconnected', () => {
      console.log('[PeerJS] Disconnected from server');
      this.emit('server-disconnected');
    });

    // 监听错误
    this.peer.on('error', (error) => {
      console.error('[PeerJS] Error:', error);
      this.emit('error', error);
    });

    // 监听关闭
    this.peer.on('close', () => {
      console.log('[PeerJS] Connection closed');
      this.emit('closed');
    });
  }

  /**
   * 设置数据连接事件处理器
   */
  private setupConnectionHandlers(conn: DataConnection): void {
    // 接收数据
    conn.on('data', (data) => {
      this.emit('data', {
        peerId: conn.peer,
        data
      });
    });

    // 连接关闭
    conn.on('close', () => {
      console.log('[PeerJS] Connection closed:', conn.peer);
      this.connections.delete(conn.peer);
      this.emit('peer-disconnected', conn.peer);
    });

    // 连接错误
    conn.on('error', (error) => {
      console.error('[PeerJS] Connection error:', error);
      this.emit('connection-error', {
        peerId: conn.peer,
        error
      });
    });
  }
}
