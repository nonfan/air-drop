/**
 * 设备发现集成测试
 */
import { DiscoveryService } from '../../services/discovery/DiscoveryService';
import { Device } from '../../types/device';
import { cleanupIntegrationTest } from './setup';

describe('Discovery Flow Integration', () => {
  let discoveryService: DiscoveryService;

  beforeEach(() => {
    discoveryService = new DiscoveryService();
  });

  afterEach(async () => {
    await discoveryService.stop();
    discoveryService.removeAllListeners();
    await cleanupIntegrationTest();
  });

  describe('Device Discovery Flow', () => {
    it('should discover and manage devices', async () => {
      await discoveryService.start();

      const device1: Device = {
        id: 'device-1',
        name: 'Desktop PC',
        type: 'desktop',
        platform: 'windows',
        address: '192.168.1.100',
        port: 8080
      };

      const device2: Device = {
        id: 'device-2',
        name: 'iPhone',
        type: 'mobile',
        platform: 'ios',
        address: '192.168.1.101',
        port: 8080
      };

      // Add devices
      discoveryService.addDevice(device1);
      discoveryService.addDevice(device2);

      const devices = discoveryService.getDevices();
      expect(devices).toHaveLength(2);
      expect(devices.map(d => d.id)).toContain('device-1');
      expect(devices.map(d => d.id)).toContain('device-2');
    });

    it('should handle device lifecycle', async () => {
      await discoveryService.start();

      const device: Device = {
        id: 'device-1',
        name: 'Test Device',
        type: 'desktop',
        platform: 'linux',
        address: '192.168.1.100',
        port: 8080
      };

      // Add device
      discoveryService.addDevice(device);
      expect(discoveryService.getDevices()).toHaveLength(1);

      // Update device
      discoveryService.updateDevice('device-1', { name: 'Updated Device' });
      const devices = discoveryService.getDevices();
      expect(devices[0].name).toBe('Updated Device');

      // Remove device
      discoveryService.removeDevice('device-1');
      expect(discoveryService.getDevices()).toHaveLength(0);
    });

    it('should emit discovery events', async () => {
      const events: string[] = [];

      discoveryService.on('device-found', () => events.push('found'));
      discoveryService.on('device-updated', () => events.push('updated'));
      discoveryService.on('device-lost', () => events.push('lost'));

      await discoveryService.start();

      const device: Device = {
        id: 'device-1',
        name: 'Test Device',
        type: 'mobile',
        platform: 'android',
        address: '192.168.1.100',
        port: 8080
      };

      discoveryService.addDevice(device);
      discoveryService.updateDevice('device-1', { name: 'Updated' });
      discoveryService.removeDevice('device-1');

      expect(events).toEqual(['found', 'updated', 'lost']);
    });
  });

  describe('Device Cleanup Flow', () => {
    it('should clean up stale devices', async () => {
      jest.useFakeTimers();

      await discoveryService.start();

      const device: Device = {
        id: 'device-1',
        name: 'Test Device',
        type: 'desktop',
        platform: 'macos',
        address: '192.168.1.100',
        port: 8080,
        lastSeen: Date.now() - 40000 // 40 seconds ago
      };

      discoveryService.addDevice(device);

      // Fast-forward time to trigger cleanup
      jest.advanceTimersByTime(11000);
      await new Promise(resolve => setImmediate(resolve));

      const devices = discoveryService.getDevices();
      expect(devices).toHaveLength(0);

      jest.useRealTimers();
    });

    it('should keep fresh devices', async () => {
      jest.useFakeTimers();

      await discoveryService.start();

      const device: Device = {
        id: 'device-1',
        name: 'Test Device',
        type: 'mobile',
        platform: 'ios',
        address: '192.168.1.100',
        port: 8080
      };

      discoveryService.addDevice(device);

      // Fast-forward time but device is fresh
      jest.advanceTimersByTime(11000);
      await new Promise(resolve => setImmediate(resolve));

      const devices = discoveryService.getDevices();
      expect(devices).toHaveLength(1);

      jest.useRealTimers();
    });
  });

  describe('Multiple Devices Flow', () => {
    it('should handle multiple devices simultaneously', async () => {
      await discoveryService.start();

      const devices: Device[] = Array.from({ length: 10 }, (_, i) => ({
        id: `device-${i}`,
        name: `Device ${i}`,
        type: i % 2 === 0 ? 'desktop' : 'mobile',
        platform: i % 2 === 0 ? 'windows' : 'ios',
        address: `192.168.1.${100 + i}`,
        port: 8080
      }));

      devices.forEach(device => discoveryService.addDevice(device));

      const discoveredDevices = discoveryService.getDevices();
      expect(discoveredDevices).toHaveLength(10);
    });

    it('should update multiple devices', async () => {
      await discoveryService.start();

      // Add devices
      for (let i = 0; i < 5; i++) {
        discoveryService.addDevice({
          id: `device-${i}`,
          name: `Device ${i}`,
          type: 'desktop',
          platform: 'linux',
          address: `192.168.1.${100 + i}`,
          port: 8080
        });
      }

      // Update all devices
      for (let i = 0; i < 5; i++) {
        discoveryService.updateDevice(`device-${i}`, {
          name: `Updated Device ${i}`
        });
      }

      const devices = discoveryService.getDevices();
      devices.forEach((device, i) => {
        expect(device.name).toBe(`Updated Device ${i}`);
      });
    });
  });

  describe('Discovery Method Selection', () => {
    it('should select appropriate discovery method', async () => {
      await discoveryService.start();

      const method = discoveryService.getMethod();
      expect(method).not.toBeNull();
      expect(['mdns', 'udp', 'manual']).toContain(method);
    });

    it('should handle discovery start/stop cycle', async () => {
      // Start
      await discoveryService.start();
      expect(discoveryService.getMethod()).not.toBeNull();

      // Add device
      discoveryService.addDevice({
        id: 'device-1',
        name: 'Test',
        type: 'desktop',
        platform: 'windows',
        address: '192.168.1.100',
        port: 8080
      });

      expect(discoveryService.getDevices()).toHaveLength(1);

      // Stop
      await discoveryService.stop();
      expect(discoveryService.getDevices()).toHaveLength(0);

      // Restart
      await discoveryService.start();
      expect(discoveryService.getMethod()).not.toBeNull();
    });
  });

  describe('Device State Management', () => {
    it('should maintain device state correctly', async () => {
      await discoveryService.start();

      const device: Device = {
        id: 'device-1',
        name: 'Test Device',
        type: 'desktop',
        platform: 'windows',
        address: '192.168.1.100',
        port: 8080
      };

      // Add device
      discoveryService.addDevice(device);
      let devices = discoveryService.getDevices();
      expect(devices[0].lastSeen).toBeDefined();
      const firstSeen = devices[0].lastSeen!;

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update device
      discoveryService.updateDevice('device-1', { name: 'Updated' });
      devices = discoveryService.getDevices();
      expect(devices[0].lastSeen).toBeGreaterThan(firstSeen);
      expect(devices[0].name).toBe('Updated');
    });

    it('should handle duplicate device additions', async () => {
      await discoveryService.start();

      const device: Device = {
        id: 'device-1',
        name: 'Test Device',
        type: 'mobile',
        platform: 'android',
        address: '192.168.1.100',
        port: 8080
      };

      // Add same device multiple times
      discoveryService.addDevice(device);
      discoveryService.addDevice(device);
      discoveryService.addDevice(device);

      // Should only have one device
      const devices = discoveryService.getDevices();
      expect(devices).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid device updates', async () => {
      await discoveryService.start();

      // Try to update non-existent device
      expect(() => {
        discoveryService.updateDevice('non-existent', { name: 'Test' });
      }).not.toThrow();

      expect(discoveryService.getDevices()).toHaveLength(0);
    });

    it('should handle invalid device removals', async () => {
      await discoveryService.start();

      // Try to remove non-existent device
      expect(() => {
        discoveryService.removeDevice('non-existent');
      }).not.toThrow();
    });
  });
});
