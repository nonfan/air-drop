import Bonjour, { Service } from 'bonjour-service';
import { v4 as uuidv4 } from 'uuid';
import { APP_CONFIG } from '../config';
import { BaseService } from './BaseService';
import { NetworkUtils } from '../utils/network';

export interface Device {
  id: string;
  name: string;
  ip: string;
  port: number;
  peerId?: string;
}

export class DeviceDiscovery extends BaseService {
  private bonjour: Bonjour;
  private browser: ReturnType<Bonjour['find']> | null = null;
  private devices = new Map<string, Device>();
  private readonly deviceId: string;
  private readonly deviceName: string;
  private readonly port: number;
  private readonly localIPs: Set<string>;
  private peerId = '';
  private publishedService: any = null;

  constructor(deviceName: string, port: number) {
    super('Discovery');
    this.bonjour = new Bonjour();
    this.deviceId = uuidv4();
    this.deviceName = deviceName;
    this.port = port;
    this.localIPs = NetworkUtils.getLocalIPs();
  }

  protected async onStart(): Promise<void> {
    if (this.peerId) {
      this.log('info', 'Starting with Peer ID:', this.peerId);
    }
    
    this.log('info', 'Device ID:', this.deviceId);
    this.log('info', 'Device Name:', this.deviceName);
    this.log('info', 'Port:', this.port);
    
    // Publish service
    await this.publishService();
    
    // Browse for devices
    await this.browseDevices();
  }

  protected async onStop(): Promise<void> {
    this.browser?.stop();
    this.browser = null;
    this.bonjour.unpublishAll();
    this.bonjour.destroy();
    this.devices.clear();
  }

  /**
   * 设置 Peer ID（用于 WebRTC 连接）
   */
  setPeerId(peerId: string): void {
    this.peerId = peerId;
    if (this.isRunning) {
      this.publishService();
    }
  }

  /**
   * 发布服务
   */
  private async publishService(): Promise<void> {
    const uniqueName = `${this.deviceName}-${this.deviceId.slice(0, 4)}`;
    
    try {
      // 先取消发布旧服务
      if (this.publishedService) {
        this.bonjour.unpublishAll();
      }
      
      this.publishedService = this.bonjour.publish({
        name: uniqueName,
        type: APP_CONFIG.SERVICE_TYPE,
        port: this.port,
        txt: { 
          id: this.deviceId, 
          displayName: this.deviceName,
          peerId: this.peerId || ''
        }
      });
      
      this.log('info', 'Published service:', uniqueName);
    } catch (err) {
      this.log('error', 'Failed to publish service:', err);
      throw err;
    }
  }

  /**
   * 浏览设备
   */
  private async browseDevices(): Promise<void> {
    this.log('info', 'Starting to browse for devices...');
    
    this.browser = this.bonjour.find(
      { type: APP_CONFIG.SERVICE_TYPE }, 
      (service: Service) => this.handleServiceFound(service)
    );

    this.browser.on('down', (service: Service) => {
      this.log('info', 'Service went down:', service.name);
      this.handleServiceLost(service);
    });
  }

  /**
   * 处理发现的服务
   */
  private handleServiceFound(service: Service): void {
    const txt = service.txt as Record<string, string> | undefined;
    const id = txt?.id;
    
    // 跳过无效或自身设备
    if (!id || id === this.deviceId) return;
    
    const ip = service.addresses?.[0] || service.host;
    
    // 跳过本机 IP
    if (NetworkUtils.isLocalIP(ip)) {
      this.log('info', 'Skipping self device by IP:', ip);
      return;
    }
    
    // 跳过相同端口（同一机器）
    if (service.port === this.port) {
      this.log('info', 'Skipping self device by port:', service.port);
      return;
    }
    
    const device: Device = {
      id,
      name: txt?.displayName || service.name,
      ip,
      port: service.port,
      peerId: txt?.peerId || undefined
    };

    this.devices.set(id, device);
    this.log('info', 'Found device:', device.name, device.ip);
    this.safeEmit('device-found', device);
  }

  /**
   * 处理丢失的服务
   */
  private handleServiceLost(service: Service): void {
    const id = (service.txt as Record<string, string> | undefined)?.id;
    
    if (id && this.devices.has(id)) {
      this.devices.delete(id);
      this.safeEmit('device-lost', id);
    }
  }

  /**
   * 获取所有已发现的设备
   */
  getDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  /**
   * @deprecated 使用 setPeerId 代替
   */
  updatePeerId(peerId: string): void {
    this.setPeerId(peerId);
  }
}
