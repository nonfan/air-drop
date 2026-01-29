import dgram from 'dgram';
import { EventEmitter } from 'events';
import { networkInterfaces } from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface Device {
  id: string;
  name: string;
  ip: string;
  port: number;
  peerId?: string;
}

export class BroadcastDiscovery extends EventEmitter {
  private socket: dgram.Socket;
  private broadcastPort: number = 3001;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private devices: Map<string, Device & { lastSeen: number }> = new Map();
  private deviceId: string;
  private deviceName: string;
  private port: number;
  private peerId: string = '';
  private localIPs: Set<string>;

  constructor(deviceName: string, port: number) {
    super();
    this.socket = dgram.createSocket('udp4');
    this.deviceId = uuidv4();
    this.deviceName = deviceName;
    this.port = port;
    this.localIPs = this.getLocalIPs();
  }

  private getLocalIPs(): Set<string> {
    const ips = new Set<string>();
    ips.add('127.0.0.1');
    ips.add('localhost');
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4') {
          ips.add(net.address);
        }
      }
    }
    return ips;
  }

  async start(peerId?: string): Promise<void> {
    if (peerId) {
      this.peerId = peerId;
    }

    console.log('[BroadcastDiscovery] Starting broadcast discovery...');
    console.log('[BroadcastDiscovery] Device ID:', this.deviceId);
    console.log('[BroadcastDiscovery] Device Name:', this.deviceName);
    console.log('[BroadcastDiscovery] Port:', this.port);

    return new Promise((resolve, reject) => {
      this.socket.bind(this.broadcastPort, () => {
        try {
          this.socket.setBroadcast(true);
          console.log('[BroadcastDiscovery] Listening on port', this.broadcastPort);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      this.socket.on('error', (err) => {
        console.error('[BroadcastDiscovery] Socket error:', err);
      });

      // 监听广播消息
      this.socket.on('message', (msg, rinfo) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.type === 'device-announce' && data.id !== this.deviceId) {
            // 跳过本机 IP
            if (this.localIPs.has(rinfo.address)) {
              return;
            }

            const device: Device & { lastSeen: number } = {
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
              console.log('[BroadcastDiscovery] Found device:', device.name, device.ip);
              this.emit('device-found', device);
            }
          }
        } catch (err) {
          // 忽略无效消息
        }
      });

      // 定期广播自己的信息
      this.broadcastInterval = setInterval(() => {
        this.broadcast();
        this.cleanupStaleDevices();
      }, 5000);

      // 立即广播一次
      setTimeout(() => this.broadcast(), 100);
    });
  }

  private broadcast() {
    const message = JSON.stringify({
      type: 'device-announce',
      id: this.deviceId,
      name: this.deviceName,
      port: this.port,
      peerId: this.peerId,
      timestamp: Date.now()
    });

    // 广播到所有网络接口
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) {
          try {
            const broadcastAddr = this.getBroadcastAddress(net.address, net.netmask);
            this.socket.send(message, this.broadcastPort, broadcastAddr, (err) => {
              if (err) {
                console.error('[BroadcastDiscovery] Broadcast error:', err.message);
              }
            });
          } catch (err) {
            // 忽略错误
          }
        }
      }
    }
  }

  private getBroadcastAddress(ip: string, netmask: string): string {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    const broadcast = ipParts.map((part, i) => part | (~maskParts[i] & 255));
    return broadcast.join('.');
  }

  private cleanupStaleDevices() {
    const now = Date.now();
    for (const [id, device] of this.devices.entries()) {
      if (now - device.lastSeen > 15000) { // 15秒未响应
        console.log('[BroadcastDiscovery] Device lost:', device.name);
        this.devices.delete(id);
        this.emit('device-lost', id);
      }
    }
  }

  getDevices(): Device[] {
    return Array.from(this.devices.values()).map(({ lastSeen, ...device }) => device);
  }

  updatePeerId(peerId: string): void {
    this.peerId = peerId;
    console.log('[BroadcastDiscovery] Updated peerId:', peerId);
    // 立即广播更新
    this.broadcast();
  }

  stop(): void {
    console.log('[BroadcastDiscovery] Stopping...');
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    this.socket.close();
  }
}
