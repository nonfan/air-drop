import Bonjour, { Service } from 'bonjour-service';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { networkInterfaces } from 'os';
import { APP_CONFIG } from '../config';

export interface Device {
  id: string;
  name: string;
  ip: string;
  port: number;
  peerId?: string;
}

export class DeviceDiscovery extends EventEmitter {
  private bonjour: Bonjour;
  private browser: ReturnType<Bonjour['find']> | null = null;
  private devices: Map<string, Device> = new Map();
  private deviceId: string;
  private deviceName: string;
  private port: number;
  private localIPs: Set<string>;
  private peerId: string = '';
  private publishedService: any = null;

  constructor(deviceName: string, port: number) {
    super();
    this.bonjour = new Bonjour();
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
    
    console.log('[Discovery] Starting device discovery service...');
    console.log('[Discovery] Device ID:', this.deviceId);
    console.log('[Discovery] Device Name:', this.deviceName);
    console.log('[Discovery] Port:', this.port);
    console.log('[Discovery] Local IPs:', Array.from(this.localIPs));
    
    // Publish this device with unique name to avoid conflicts
    const uniqueName = `${this.deviceName}-${this.deviceId.slice(0, 4)}`;
    try {
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
      console.log('[Discovery] Published service:', uniqueName);
    } catch (err) {
      console.error('[Discovery] Failed to publish service:', err);
    }

    // Browse for other devices
    console.log('[Discovery] Starting to browse for devices...');
    this.browser = this.bonjour.find({ type: APP_CONFIG.SERVICE_TYPE }, (service: Service) => {
      console.log('[Discovery] Found service:', service.name, service.addresses);
      this.handleServiceFound(service);
    });

    this.browser.on('down', (service: Service) => {
      console.log('[Discovery] Service went down:', service.name);
      this.handleServiceLost(service);
    });
    
    console.log('[Discovery] Device discovery service started');
  }

  private handleServiceFound(service: Service): void {
    const txt = service.txt as Record<string, string> | undefined;
    const id = txt?.id;
    
    // Skip if no id or if it's our own device
    if (!id) return;
    if (id === this.deviceId) return;
    
    // Check by IP to avoid self-discovery issues
    const ip = service.addresses?.[0] || service.host;
    if (this.localIPs.has(ip)) {
      console.log('Skipping self device by IP:', ip);
      return;
    }
    
    // Also skip if port matches our own (same machine)
    if (service.port === this.port && this.localIPs.has(ip)) {
      console.log('Skipping self device by port:', service.port);
      return;
    }
    
    const displayName = txt?.displayName || service.name;
    const peerId = txt?.peerId || '';
    const device: Device = {
      id,
      name: displayName,
      ip,
      port: service.port,
      peerId: peerId || undefined
    };

    this.devices.set(id, device);
    this.emit('device-found', device);
  }

  private handleServiceLost(service: Service): void {
    const id = service.txt?.id;
    if (id && this.devices.has(id)) {
      this.devices.delete(id);
      this.emit('device-lost', id);
    }
  }

  getDevices(): Device[] {
    return Array.from(this.devices.values());
  }

  updatePeerId(peerId: string): void {
    this.peerId = peerId;
    // Republish service with updated peerId
    if (this.publishedService) {
      this.bonjour.unpublishAll();
      const uniqueName = `${this.deviceName}-${this.deviceId.slice(0, 4)}`;
      try {
        this.publishedService = this.bonjour.publish({
          name: uniqueName,
          type: APP_CONFIG.SERVICE_TYPE,
          port: this.port,
          txt: { 
            id: this.deviceId, 
            displayName: this.deviceName,
            peerId: this.peerId
          }
        });
        console.log('Updated Bonjour service with peerId:', peerId);
      } catch (err) {
        console.error('Failed to republish service:', err);
      }
    }
  }

  stop(): void {
    this.browser?.stop();
    this.bonjour.unpublishAll();
    this.bonjour.destroy();
  }
}
