import Peer, { DataConnection } from 'peerjs';
import { EventEmitter } from 'events';

export interface DeviceInfo {
  id: string;
  peerId: string;
  name: string;
  ip: string;
  port: number;
  type: 'desktop' | 'mobile';
  socketUrl: string;
  lastSeen: number;
}

export interface LocalDeviceInfo {
  name: string;
  ip: string;
  port: number;
  type: 'desktop' | 'mobile';
}

/**
 * PeerJS 设备发现服务
 * 只负责设备发现和连接信息交换，不负责文件传输
 */
export class PeerDiscoveryService extends EventEmitter {
  private peer: Peer | null = null;
  private peerId: string = '';
  private devices: Map<string, DeviceInfo> = new Map();
  private connections: Map<string, DataConnection> = new Map();
  private localDeviceInfo: LocalDeviceInfo | null = null;
  private announceInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * 启动发现服务
   */
  async start(deviceInfo: LocalDeviceInfo, config?: {
    host?: string;
    port?: number;
    secure?: boolean;
  }): Promise<void> {
    this.localDeviceInfo = deviceInfo;

    // 创建 Peer 实例
    this.peer = new Peer({
      host: config?.host || 'peerjs-server.com',
      port: config?.port || 443,
      secure: config?.secure !== false,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      },
      debug: 2
    });

    await this.waitForOpen();
    this.setupEventHandlers();
    this.startAnnouncing();
    this.startCleanup();

    console.log('[PeerDiscovery] Started with Peer ID:', this.peerId);
  }

  /**
   * 停止发现服务
   */
  stop(): void {
    if (this.announceInterval) {
      clearInterval(this.announceInterval);
      this.announceInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.connections.forEach(conn => conn.close());
    this.connections.clear();
    this.devices.clear();

    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    console.log('[PeerDiscovery] Stopped');
  }

  /**
   * 获取当前 Peer ID
   */
  getPeerId(): string {
    return this.peerId;
  }

  /**
   * 获取已发现的设备列表
   */
  getDevices(): DeviceInfo[] {
    return Array.from(this.devices.values());
  }

  /**
   * 主动连接到指定 Peer ID
   */
  async connectToPeer(peerId: string): Promise<void> {
    if (!this.peer || this.connections.has(peerId)) {
      return;
    }

    console.log('[PeerDiscovery] Connecting to peer:', peerId);

    const conn = this.peer.connect(peerId, {
      reliable: true,
      serialization: 'json'
    });

    await this.waitForConnection(conn);
    this.setupConnectionHandlers(conn);
    this.connections.set(peerId, conn);

    // 发送自己的设备信息
    this.sendDeviceInfo(conn);
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
      console.log('[PeerDiscovery] Incoming connection from:', conn.peer);

      conn.on('open', () => {
        this.setupConnectionHandlers(conn);
        this.connections.set(conn.peer, conn);

        // 发送自己的设备信息
        this.sendDeviceInfo(conn);
      });
    });

    // 监听错误
    this.peer.on('error', (error) => {
      console.error('[PeerDiscovery] Error:', error);
      this.emit('error', error);
    });

    // 监听断开连接
    this.peer.on('disconnected', () => {
      console.log('[PeerDiscovery] Disconnected from server');
      this.emit('disconnected');
    });
  }

  /**
   * 设置数据连接事件处理器
   */
  private setupConnectionHandlers(conn: DataConnection): void {
    conn.on('data', (data: any) => {
      this.handleIncomingData(conn.peer, data);
    });

    conn.on('close', () => {
      console.log('[PeerDiscovery] Connection closed:', conn.peer);
      this.connections.delete(conn.peer);
      this.removeDevice(conn.peer);
    });

    conn.on('error', (error) => {
      console.error('[PeerDiscovery] Connection error:', error);
      this.connections.delete(conn.peer);
    });
  }

  /**
   * 处理接收到的数据
   */
  private handleIncomingData(peerId: string, data: any): void {
    if (data.type === 'device-announce') {
      const deviceInfo: DeviceInfo = {
        id: peerId,
        peerId: peerId,
        name: data.name,
        ip: data.ip,
        port: data.port,
        type: data.deviceType,
        socketUrl: `http://${data.ip}:${data.port}`,
        lastSeen: Date.now()
      };

      const isNew = !this.devices.has(peerId);
      this.devices.set(peerId, deviceInfo);

      if (isNew) {
        console.log('[PeerDiscovery] New device discovered:', deviceInfo);
        this.emit('device-found', deviceInfo);
      } else {
        console.log('[PeerDiscovery] Device updated:', deviceInfo);
        this.emit('device-updated', deviceInfo);
      }
    }
  }

  /**
   * 发送设备信息
   */
  private sendDeviceInfo(conn: DataConnection): void {
    if (!this.localDeviceInfo || !conn.open) return;

    const message = {
      type: 'device-announce',
      name: this.localDeviceInfo.name,
      ip: this.localDeviceInfo.ip,
      port: this.localDeviceInfo.port,
      deviceType: this.localDeviceInfo.type
    };

    try {
      conn.send(message);
      console.log('[PeerDiscovery] Sent device info to:', conn.peer);
    } catch (error) {
      console.error('[PeerDiscovery] Failed to send device info:', error);
    }
  }

  /**
   * 定期广播设备信息
   */
  private startAnnouncing(): void {
    // 立即广播一次
    this.announceToAll();

    // 每 10 秒广播一次
    this.announceInterval = setInterval(() => {
      this.announceToAll();
    }, 10000);
  }

  /**
   * 向所有已连接的设备广播
   */
  private announceToAll(): void {
    this.connections.forEach((conn) => {
      if (conn.open) {
        this.sendDeviceInfo(conn);
      }
    });
  }

  /**
   * 定期清理过期设备
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 秒超时

      this.devices.forEach((device, peerId) => {
        if (now - device.lastSeen > timeout) {
          console.log('[PeerDiscovery] Device timeout:', peerId);
          this.removeDevice(peerId);
        }
      });
    }, 10000); // 每 10 秒检查一次
  }

  /**
   * 移除设备
   */
  private removeDevice(peerId: string): void {
    if (this.devices.delete(peerId)) {
      console.log('[PeerDiscovery] Device removed:', peerId);
      this.emit('device-lost', peerId);
    }
  }
}
