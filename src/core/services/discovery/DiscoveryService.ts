import { EventEmitter } from 'events';
import { Device } from '../../types/device';

export type DiscoveryMethod = 'mdns' | 'udp' | 'manual';

/**
 * 统一的设备发现服务
 * 自动选择最佳的发现方式（mDNS 或 UDP）
 */
export class DiscoveryService extends EventEmitter {
  private method: DiscoveryMethod | null = null;
  private devices: Map<string, Device> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly deviceTimeout = 30000; // 30 seconds

  async start(): Promise<void> {
    // 尝试 mDNS（如果在 Electron 环境）
    if (typeof window !== 'undefined' && (window as any).electron) {
      try {
        await this.startMDNS();
        this.method = 'mdns';
        console.log('[Discovery] Using mDNS');
        this.startCleanupTimer();
        return;
      } catch (error) {
        console.warn('[Discovery] mDNS failed:', error);
      }
    }

    // 回退到 UDP（Web 环境）
    try {
      await this.startUDP();
      this.method = 'udp';
      console.log('[Discovery] Using UDP broadcast');
      this.startCleanupTimer();
    } catch (error) {
      console.error('[Discovery] All discovery methods failed:', error);
      this.method = 'manual';
    }
  }

  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.devices.clear();
  }

  getDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  addDevice(device: Device): void {
    device.lastSeen = Date.now();
    this.devices.set(device.id, device);
    this.emit('device-found', device);
  }

  removeDevice(deviceId: string): void {
    if (this.devices.delete(deviceId)) {
      this.emit('device-lost', deviceId);
    }
  }

  updateDevice(deviceId: string, updates: Partial<Device>): void {
    const device = this.devices.get(deviceId);
    if (device) {
      Object.assign(device, updates);
      device.lastSeen = Date.now();
      this.emit('device-updated', device);
    }
  }

  getMethod(): DiscoveryMethod | null {
    return this.method;
  }

  private async startMDNS(): Promise<void> {
    // mDNS implementation would go here
    // This is a placeholder for Electron environment
    throw new Error('mDNS not implemented yet');
  }

  private async startUDP(): Promise<void> {
    // UDP implementation would use the existing UDPDiscovery class
    // This is a placeholder
    console.log('[Discovery] UDP discovery started');
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, device] of this.devices.entries()) {
        if (device.lastSeen && now - device.lastSeen > this.deviceTimeout) {
          this.removeDevice(id);
        }
      }
    }, 10000); // Check every 10 seconds
  }
}
