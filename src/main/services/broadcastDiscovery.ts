import dgram from 'dgram';
import { v4 as uuidv4 } from 'uuid';
import { BaseService } from './BaseService';
import { NetworkUtils } from '../utils/network';
import { networkInterfaces } from 'os';

export interface Device {
  id: string;
  name: string;
  ip: string;
  port: number;
  peerId?: string;
}

interface DeviceWithTimestamp extends Device {
  lastSeen: number;
}

export class BroadcastDiscovery extends BaseService {
  private socket!: dgram.Socket;
  private readonly broadcastPort = 3001;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private devices = new Map<string, DeviceWithTimestamp>();
  private readonly deviceId: string;
  private readonly deviceName: string;
  private readonly port: number;
  private readonly localIPs: Set<string>;
  private peerId = '';

  private readonly BROADCAST_INTERVAL_MS = 5000;
  private readonly DEVICE_TIMEOUT_MS = 15000;

  constructor(deviceName: string, port: number) {
    super('BroadcastDiscovery');
    this.deviceId = uuidv4();
    this.deviceName = deviceName;
    this.port = port;
    this.localIPs = NetworkUtils.getLocalIPs();
  }

  protected async onStart(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket('udp4');
      
      this.socket.on('error', (err) => {
        this.log('error', 'Socket error:', err);
        reject(err);
      });

      this.socket.bind(this.broadcastPort, () => {
        try {
          this.socket.setBroadcast(true);
          this.log('info', 'Listening on port', this.broadcastPort);
          
          // 设置消息监听
          this.setupMessageHandler();
          
          // 开始定期广播
          this.startBroadcasting();
          
          // 开始清理过期设备
          this.startCleanup();
          
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  protected async onStop(): Promise<void> {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    if (this.socket) {
      this.socket.close();
    }
    
    this.devices.clear();
  }

  /**
   * 设置 Peer ID
   */
  setPeerId(peerId: string): void {
    this.peerId = peerId;
    if (this.isRunning) {
      this.broadcast();
    }
  }

  /**
   * 设置消息处理器
   */
  private setupMessageHandler(): void {
    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        
        if (data.type === 'device-announce' && data.id !== this.deviceId) {
          // 跳过本机 IP
          if (NetworkUtils.isLocalIP(rinfo.address)) {
            return;
          }

          const device: DeviceWithTimestamp = {
            id: data.id,
            name: data.name,
            ip: rinfo.address,
            port: data.port,
            peerId: data.peerId || undefined,
            lastSeen: Date.now()
          };

          const isNew = !this.devices.has(data.id);
          this.devices.set(data.id, device);

          if (isNew) {
            this.log('info', 'Found device:', device.name, device.ip);
            this.safeEmit('device-found', this.stripTimestamp(device));
          }
        }
      } catch (err) {
        // 忽略无效消息
      }
    });
  }

  /**
   * 开始定期广播
   */
  private startBroadcasting(): void {
    // 立即广播一次
    setTimeout(() => this.broadcast(), 100);
    
    // 定期广播
    this.broadcastInterval = setInterval(
      () => this.broadcast(), 
      this.BROADCAST_INTERVAL_MS
    );
  }

  /**
   * 开始清理过期设备
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(
      () => this.cleanupStaleDevices(), 
      this.BROADCAST_INTERVAL_MS
    );
  }

  /**
   * 广播设备信息
   */
  private broadcast(): void {
    const message = JSON.stringify({
      type: 'device-announce',
      id: this.deviceId,
      name: this.deviceName,
      port: this.port,
      peerId: this.peerId,
      timestamp: Date.now()
    });

    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
      const interfaces = nets[name];
      if (!interfaces) continue;
      
      for (const net of interfaces) {
        if (net.family === 'IPv4' && !net.internal) {
          try {
            const broadcastAddr = NetworkUtils.getBroadcastAddress(
              net.address, 
              net.netmask
            );
            
            this.socket.send(
              message, 
              this.broadcastPort, 
              broadcastAddr, 
              (err) => {
                if (err) {
                  this.log('error', 'Broadcast error:', err.message);
                }
              }
            );
          } catch (err) {
            // 忽略错误
          }
        }
      }
    }
  }

  /**
   * 清理过期设备
   */
  private cleanupStaleDevices(): void {
    const now = Date.now();
    
    for (const [id, device] of this.devices.entries()) {
      if (now - device.lastSeen > this.DEVICE_TIMEOUT_MS) {
        this.log('info', 'Device lost:', device.name);
        this.devices.delete(id);
        this.safeEmit('device-lost', id);
      }
    }
  }

  /**
   * 移除时间戳字段
   */
  private stripTimestamp(device: DeviceWithTimestamp): Device {
    const { lastSeen, ...deviceWithoutTimestamp } = device;
    return deviceWithoutTimestamp;
  }

  /**
   * 获取所有已发现的设备
   */
  getDevices(): Device[] {
    return Array.from(this.devices.values()).map(d => this.stripTimestamp(d));
  }

  /**
   * @deprecated 使用 setPeerId 代替
   */
  updatePeerId(peerId: string): void {
    this.setPeerId(peerId);
  }
}
