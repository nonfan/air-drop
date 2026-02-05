/**
 * UDP 广播服务 - 统一的设备发现
 * 用于桌面端之间的快速发现（<100ms）
 */
import * as dgram from 'dgram';
import { EventEmitter } from 'events';
import { NetworkUtils } from '../utils/network';

export interface BroadcastDevice {
  id: string;
  name: string;
  ip: string;
  port: number;
  type: 'desktop' | 'mobile';
  lastSeen: number;
}

export interface BroadcastMessage {
  type: 'announce' | 'discover' | 'response';
  id: string;
  name: string;
  port: number;
  timestamp: number;
}

/**
 * UDP 广播服务
 * 负责桌面端之间的设备发现
 */
export class UDPBroadcastService extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private readonly BROADCAST_PORT = 3001;
  private readonly FAST_ANNOUNCE_INTERVAL = 500;   // 快速阶段：500ms
  private readonly NORMAL_ANNOUNCE_INTERVAL = 5000; // 正常阶段：5秒
  private readonly FAST_PHASE_DURATION = 10000;     // 快速阶段持续 10 秒
  private readonly DEVICE_TIMEOUT = 30000; // 30秒超时
  private devices: Map<string, BroadcastDevice> = new Map();
  private announceTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private deviceId: string;
  private deviceName: string;
  private serverPort: number;
  private isRunning = false;
  private startTime: number = 0;

  constructor(deviceId: string, deviceName: string, serverPort: number) {
    super();
    this.deviceId = deviceId;
    this.deviceName = deviceName;
    this.serverPort = serverPort;
  }

  /**
   * 启动 UDP 广播服务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[UDP Broadcast] Already running');
      return;
    }

    try {
      this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

      // 设置广播
      this.socket.on('listening', () => {
        try {
          this.socket!.setBroadcast(true);
          const address = this.socket!.address();
          console.log(`[UDP Broadcast] Listening on ${address.address}:${address.port}`);
          this.isRunning = true;
          this.emit('started');
        } catch (error) {
          console.error('[UDP Broadcast] Failed to set broadcast:', error);
        }
      });

      // 接收消息
      this.socket.on('message', (msg, rinfo) => {
        this.handleMessage(msg, rinfo);
      });

      // 错误处理
      this.socket.on('error', (err) => {
        console.error('[UDP Broadcast] Socket error:', err);
        this.emit('error', err);
      });

      // 绑定端口
      this.socket.bind(this.BROADCAST_PORT);

      // 记录启动时间
      this.startTime = Date.now();

      // 开始智能广播（动态调整频率）
      this.startSmartAnnouncing();

      // 开始清理过期设备
      this.startCleanup();

      // 立即发送 3 次发现请求（提高发现速度）
      this.sendDiscovery();
      setTimeout(() => this.sendDiscovery(), 100);
      setTimeout(() => this.sendDiscovery(), 200);

    } catch (error) {
      console.error('[UDP Broadcast] Failed to start:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 停止 UDP 广播服务
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('[UDP Broadcast] Stopping...');

    // 停止定时器
    if (this.announceTimer) {
      clearInterval(this.announceTimer);
      this.announceTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // 关闭 socket
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    // 清空设备列表
    this.devices.clear();

    this.isRunning = false;
    this.emit('stopped');
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      const message: BroadcastMessage = JSON.parse(msg.toString());

      // 忽略自己的消息
      if (message.id === this.deviceId) {
        return;
      }

      // 忽略来自本机 IP 的消息
      if (NetworkUtils.isLocalIP(rinfo.address)) {
        return;
      }

      const device: BroadcastDevice = {
        id: message.id,
        name: message.name,
        ip: rinfo.address,
        port: message.port,
        type: 'desktop',
        lastSeen: Date.now()
      };

      const isNew = !this.devices.has(device.id);
      this.devices.set(device.id, device);

      if (isNew) {
        console.log('[UDP Broadcast] New device found:', device.name, device.ip);
        this.emit('device-found', device);
      } else {
        this.emit('device-updated', device);
      }

      // 如果收到发现请求，立即响应
      if (message.type === 'discover') {
        this.sendResponse(rinfo.address);
      }

    } catch (error) {
      // 忽略无效消息
      console.debug('[UDP Broadcast] Invalid message from', rinfo.address);
    }
  }

  /**
   * 智能广播：启动后 10 秒内高频广播，之后降低频率
   */
  private startSmartAnnouncing(): void {
    const announce = () => {
      this.sendAnnounce();
      
      // 动态调整间隔
      const elapsed = Date.now() - this.startTime;
      const interval = elapsed < this.FAST_PHASE_DURATION 
        ? this.FAST_ANNOUNCE_INTERVAL 
        : this.NORMAL_ANNOUNCE_INTERVAL;
      
      if (elapsed === this.FAST_ANNOUNCE_INTERVAL || elapsed === this.NORMAL_ANNOUNCE_INTERVAL) {
        console.log(`[UDP Broadcast] Switching to ${interval}ms interval`);
      }
      
      this.announceTimer = setTimeout(announce, interval);
    };
    
    // 立即发送第一次
    announce();
  }

  /**
   * 开始定期广播（已废弃，使用 startSmartAnnouncing）
   */
  private startAnnouncing(): void {
    this.startSmartAnnouncing();
  }

  /**
   * 发送广播消息
   */
  private sendAnnounce(): void {
    if (!this.socket || !this.isRunning) return;

    const message: BroadcastMessage = {
      type: 'announce',
      id: this.deviceId,
      name: this.deviceName,
      port: this.serverPort,
      timestamp: Date.now()
    };

    const buffer = Buffer.from(JSON.stringify(message));

    // 广播到所有网络接口
    const broadcastAddress = '255.255.255.255';
    
    this.socket.send(buffer, 0, buffer.length, this.BROADCAST_PORT, broadcastAddress, (err) => {
      if (err) {
        console.error('[UDP Broadcast] Failed to send announce:', err);
      }
    });
  }

  /**
   * 发送发现请求
   */
  private sendDiscovery(): void {
    if (!this.socket || !this.isRunning) return;

    const message: BroadcastMessage = {
      type: 'discover',
      id: this.deviceId,
      name: this.deviceName,
      port: this.serverPort,
      timestamp: Date.now()
    };

    const buffer = Buffer.from(JSON.stringify(message));
    const broadcastAddress = '255.255.255.255';

    this.socket.send(buffer, 0, buffer.length, this.BROADCAST_PORT, broadcastAddress, (err) => {
      if (err) {
        console.error('[UDP Broadcast] Failed to send discovery:', err);
      }
    });
  }

  /**
   * 发送响应消息（单播）
   */
  private sendResponse(targetIP: string): void {
    if (!this.socket || !this.isRunning) return;

    const message: BroadcastMessage = {
      type: 'response',
      id: this.deviceId,
      name: this.deviceName,
      port: this.serverPort,
      timestamp: Date.now()
    };

    const buffer = Buffer.from(JSON.stringify(message));

    this.socket.send(buffer, 0, buffer.length, this.BROADCAST_PORT, targetIP, (err) => {
      if (err) {
        console.error('[UDP Broadcast] Failed to send response:', err);
      }
    });
  }

  /**
   * 开始清理过期设备
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();

      for (const [id, device] of this.devices.entries()) {
        if (now - device.lastSeen > this.DEVICE_TIMEOUT) {
          console.log('[UDP Broadcast] Device timeout:', device.name);
          this.devices.delete(id);
          this.emit('device-lost', id);
        }
      }
    }, 10000); // 每 10 秒检查一次
  }

  /**
   * 获取已发现的设备列表
   */
  getDevices(): BroadcastDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * 手动触发一次发现
   */
  discover(): void {
    this.sendDiscovery();
  }

  /**
   * 更新设备名称
   */
  updateDeviceName(name: string): void {
    this.deviceName = name;
    // 立即广播更新
    this.sendAnnounce();
  }
}
