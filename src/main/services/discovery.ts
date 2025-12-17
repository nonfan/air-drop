import Bonjour, { Service } from 'bonjour-service';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { networkInterfaces } from 'os';

export interface Device {
  id: string;
  name: string;
  ip: string;
  port: number;
}

export class DeviceDiscovery extends EventEmitter {
  private bonjour: Bonjour;
  private browser: ReturnType<Bonjour['find']> | null = null;
  private devices: Map<string, Device> = new Map();
  private deviceId: string;
  private deviceName: string;
  private port: number;
  private localIPs: Set<string>;

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

  async start(): Promise<void> {
    // Publish this device with unique name to avoid conflicts
    const uniqueName = `${this.deviceName}-${this.deviceId.slice(0, 4)}`;
    try {
      this.bonjour.publish({
        name: uniqueName,
        type: 'windrop',
        port: this.port,
        txt: { id: this.deviceId, displayName: this.deviceName }
      });
    } catch (err) {
      console.error('Failed to publish service:', err);
    }

    // Browse for other devices
    this.browser = this.bonjour.find({ type: 'windrop' }, (service: Service) => {
      this.handleServiceFound(service);
    });

    this.browser.on('down', (service: Service) => {
      this.handleServiceLost(service);
    });
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
    const device: Device = {
      id,
      name: displayName,
      ip,
      port: service.port
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

  stop(): void {
    this.browser?.stop();
    this.bonjour.unpublishAll();
    this.bonjour.destroy();
  }
}
