/**
 * DiscoveryService 单元测试
 */
import { DiscoveryService } from '../services/discovery/DiscoveryService';
import { Device } from '../types/device';

describe('DiscoveryService', () => {
  let service: DiscoveryService;

  beforeEach(() => {
    service = new DiscoveryService();
  });

  afterEach(async () => {
    await service.stop();
    service.removeAllListeners();
  });

  describe('start', () => {
    it('should start discovery service', async () => {
      await service.start();

      const method = service.getMethod();
      expect(method).not.toBeNull();
    });

    it('should select appropriate discovery method', async () => {
      await service.start();

      const method = service.getMethod();
      expect(['mdns', 'udp', 'manual']).toContain(method);
    });
  });

  describe('stop', () => {
    it('should stop discovery service', async () => {
      await service.start();
      await service.stop();

      const devices = service.getDevices();
      expect(devices).toHaveLength(0);
    });

    it('should clear all devices on stop', async () => {
      await service.start();
      
      const mockDevice: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'desktop',
        platform: 'windows',
        address: '192.168.1.100',
        port: 8080,
        lastSeen: Date.now()
      };
      
      service.addDevice(mockDevice);
      await service.stop();

      expect(service.getDevices()).toHaveLength(0);
    });
  });

  describe('addDevice', () => {
    it('should add a device', async () => {
      await service.start();

      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'mobile',
        platform: 'ios',
        address: '192.168.1.100',
        port: 8080
      };

      service.addDevice(device);

      const devices = service.getDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0].id).toBe('test-1');
    });

    it('should emit device-found event', (done) => {
      service.on('device-found', (device) => {
        expect(device.id).toBe('test-1');
        done();
      });

      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'mobile',
        platform: 'android',
        address: '192.168.1.100',
        port: 8080
      };

      service.addDevice(device);
    });

    it('should update lastSeen timestamp', () => {
      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'desktop',
        platform: 'macos',
        address: '192.168.1.100',
        port: 8080
      };

      service.addDevice(device);

      const devices = service.getDevices();
      expect(devices[0].lastSeen).toBeDefined();
      expect(devices[0].lastSeen).toBeGreaterThan(0);
    });

    it('should update existing device', () => {
      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'mobile',
        platform: 'ios',
        address: '192.168.1.100',
        port: 8080
      };

      service.addDevice(device);
      
      const updatedDevice: Device = {
        ...device,
        name: 'Updated Device'
      };
      
      service.addDevice(updatedDevice);

      const devices = service.getDevices();
      expect(devices).toHaveLength(1);
      expect(devices[0].name).toBe('Updated Device');
    });
  });

  describe('removeDevice', () => {
    it('should remove a device', () => {
      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'desktop',
        platform: 'linux',
        address: '192.168.1.100',
        port: 8080
      };

      service.addDevice(device);
      service.removeDevice('test-1');

      const devices = service.getDevices();
      expect(devices).toHaveLength(0);
    });

    it('should emit device-lost event', (done) => {
      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'mobile',
        platform: 'android',
        address: '192.168.1.100',
        port: 8080
      };

      service.addDevice(device);

      service.on('device-lost', (deviceId) => {
        expect(deviceId).toBe('test-1');
        done();
      });

      service.removeDevice('test-1');
    });

    it('should handle removing non-existent device', () => {
      expect(() => service.removeDevice('non-existent')).not.toThrow();
    });
  });

  describe('updateDevice', () => {
    it('should update device properties', () => {
      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'desktop',
        platform: 'windows',
        address: '192.168.1.100',
        port: 8080
      };

      service.addDevice(device);
      service.updateDevice('test-1', { name: 'Updated Name' });

      const devices = service.getDevices();
      expect(devices[0].name).toBe('Updated Name');
    });

    it('should emit device-updated event', (done) => {
      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'mobile',
        platform: 'ios',
        address: '192.168.1.100',
        port: 8080
      };

      service.addDevice(device);

      service.on('device-updated', (updatedDevice) => {
        expect(updatedDevice.name).toBe('New Name');
        done();
      });

      service.updateDevice('test-1', { name: 'New Name' });
    });

    it('should update lastSeen on update', async () => {
      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'desktop',
        platform: 'macos',
        address: '192.168.1.100',
        port: 8080
      };

      service.addDevice(device);
      const firstSeen = service.getDevices()[0].lastSeen;

      await new Promise(resolve => setTimeout(resolve, 10));
      
      service.updateDevice('test-1', { name: 'Updated' });
      const secondSeen = service.getDevices()[0].lastSeen;

      expect(secondSeen).toBeGreaterThan(firstSeen!);
    });

    it('should handle updating non-existent device', () => {
      expect(() => service.updateDevice('non-existent', { name: 'Test' })).not.toThrow();
    });
  });

  describe('getDevices', () => {
    it('should return empty array initially', () => {
      const devices = service.getDevices();
      expect(devices).toEqual([]);
    });

    it('should return all devices', () => {
      const device1: Device = {
        id: 'test-1',
        name: 'Device 1',
        type: 'desktop',
        platform: 'windows',
        address: '192.168.1.100',
        port: 8080
      };

      const device2: Device = {
        id: 'test-2',
        name: 'Device 2',
        type: 'mobile',
        platform: 'android',
        address: '192.168.1.101',
        port: 8080
      };

      service.addDevice(device1);
      service.addDevice(device2);

      const devices = service.getDevices();
      expect(devices).toHaveLength(2);
    });
  });

  describe('device cleanup', () => {
    it('should remove stale devices', async () => {
      jest.useFakeTimers();

      await service.start();

      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'desktop',
        platform: 'linux',
        address: '192.168.1.100',
        port: 8080,
        lastSeen: Date.now() - 40000 // 40 seconds ago (stale)
      };

      service.addDevice(device);

      // Fast-forward time to trigger cleanup
      jest.advanceTimersByTime(11000);

      await new Promise(resolve => setImmediate(resolve));

      const devices = service.getDevices();
      expect(devices).toHaveLength(0);

      jest.useRealTimers();
    });

    it('should keep fresh devices', async () => {
      jest.useFakeTimers();

      await service.start();

      const device: Device = {
        id: 'test-1',
        name: 'Test Device',
        type: 'mobile',
        platform: 'ios',
        address: '192.168.1.100',
        port: 8080
      };

      service.addDevice(device);

      // Fast-forward time but device is fresh
      jest.advanceTimersByTime(11000);

      await new Promise(resolve => setImmediate(resolve));

      const devices = service.getDevices();
      expect(devices).toHaveLength(1);

      jest.useRealTimers();
    });
  });

  describe('getMethod', () => {
    it('should return null before start', () => {
      expect(service.getMethod()).toBeNull();
    });

    it('should return method after start', async () => {
      await service.start();

      const method = service.getMethod();
      expect(method).not.toBeNull();
    });
  });
});
