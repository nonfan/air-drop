/**
 * PairingService 单元测试
 */

import { PairingService, PairingCode, TrustedDevice } from '../services/security/PairingService';

describe('PairingService', () => {
  let pairingService: PairingService;

  beforeEach(() => {
    pairingService = new PairingService();
  });

  describe('配对码生成', () => {
    it('应该生成配对码', () => {
      const deviceId = 'device-1';
      const publicKey = 'test-public-key';
      
      const pairingCode = pairingService.generatePairingCode(deviceId, publicKey);
      
      expect(pairingCode).toBeDefined();
      expect(pairingCode.code).toHaveLength(6);
      expect(pairingCode.deviceId).toBe(deviceId);
      expect(pairingCode.publicKey).toBe(publicKey);
      expect(pairingCode.expiresAt).toBeGreaterThan(Date.now());
    });

    it('配对码应该是6位数字', () => {
      const pairingCode = pairingService.generatePairingCode('device-1', 'key');
      
      expect(pairingCode.code).toMatch(/^\d{6}$/);
    });

    it('每次生成的配对码应该不同', () => {
      const code1 = pairingService.generatePairingCode('device-1', 'key1');
      const code2 = pairingService.generatePairingCode('device-2', 'key2');
      
      expect(code1.code).not.toBe(code2.code);
    });

    it('配对码应该在5分钟后过期', () => {
      const pairingCode = pairingService.generatePairingCode('device-1', 'key');
      const expectedExpiry = Date.now() + 5 * 60 * 1000;
      
      expect(pairingCode.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(pairingCode.expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
    });
  });

  describe('配对码验证', () => {
    it('应该验证正确的配对码', async () => {
      const deviceId = 'device-1';
      const deviceName = 'Test Device';
      const publicKey = 'test-public-key';
      
      const pairingCode = pairingService.generatePairingCode(deviceId, publicKey);
      const result = await pairingService.verifyPairingCode(
        pairingCode.code,
        deviceId,
        deviceName
      );
      
      expect(result.success).toBe(true);
      expect(result.publicKey).toBe(publicKey);
    });

    it('错误的配对码应该验证失败', async () => {
      const deviceId = 'device-1';
      pairingService.generatePairingCode(deviceId, 'key');
      
      const result = await pairingService.verifyPairingCode(
        '000000',
        deviceId,
        'Test Device'
      );
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalid_code');
    });

    it('不存在的配对应该验证失败', async () => {
      const result = await pairingService.verifyPairingCode(
        '123456',
        'non-existent',
        'Test Device'
      );
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('pairing_not_found');
    });

    it('过期的配对码应该验证失败', async () => {
      const deviceId = 'device-1';
      const pairingCode = pairingService.generatePairingCode(deviceId, 'key');
      
      // 模拟过期
      jest.spyOn(Date, 'now').mockReturnValue(pairingCode.expiresAt + 1000);
      
      const result = await pairingService.verifyPairingCode(
        pairingCode.code,
        deviceId,
        'Test Device'
      );
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('pairing_expired');
      
      jest.restoreAllMocks();
    });

    it('超过最大尝试次数应该失败', async () => {
      const deviceId = 'device-1';
      pairingService.generatePairingCode(deviceId, 'key');
      
      // 尝试3次错误的配对码
      await pairingService.verifyPairingCode('000000', deviceId, 'Test');
      await pairingService.verifyPairingCode('000000', deviceId, 'Test');
      await pairingService.verifyPairingCode('000000', deviceId, 'Test');
      
      // 第4次应该失败
      const result = await pairingService.verifyPairingCode('000000', deviceId, 'Test');
      
      expect(result.success).toBe(false);
      expect(result.reason).toBe('too_many_attempts');
    });
  });

  describe('受信任设备管理', () => {
    it('应该保存受信任设备', async () => {
      await pairingService.saveTrustedDevice('device-1', 'Test Device', 'key');
      
      const device = pairingService.getTrustedDevice('device-1');
      
      expect(device).toBeDefined();
      expect(device?.deviceId).toBe('device-1');
      expect(device?.deviceName).toBe('Test Device');
      expect(device?.publicKey).toBe('key');
    });

    it('应该获取所有受信任设备', async () => {
      await pairingService.saveTrustedDevice('device-1', 'Device 1', 'key1');
      await pairingService.saveTrustedDevice('device-2', 'Device 2', 'key2');
      
      const devices = pairingService.getTrustedDevices();
      
      expect(devices).toHaveLength(2);
    });

    it('应该检查设备是否受信任', async () => {
      await pairingService.saveTrustedDevice('device-1', 'Test Device', 'key');
      
      expect(pairingService.isTrustedDevice('device-1')).toBe(true);
      expect(pairingService.isTrustedDevice('device-2')).toBe(false);
    });

    it('应该移除受信任设备', async () => {
      await pairingService.saveTrustedDevice('device-1', 'Test Device', 'key');
      
      const removed = await pairingService.removeTrustedDevice('device-1');
      
      expect(removed).toBe(true);
      expect(pairingService.isTrustedDevice('device-1')).toBe(false);
    });

    it('移除不存在的设备应该返回 false', async () => {
      const removed = await pairingService.removeTrustedDevice('non-existent');
      
      expect(removed).toBe(false);
    });

    it('应该更新设备最后见到时间', async () => {
      await pairingService.saveTrustedDevice('device-1', 'Test Device', 'key');
      
      const before = pairingService.getTrustedDevice('device-1')?.lastSeen;
      
      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));
      
      pairingService.updateLastSeen('device-1');
      
      const after = pairingService.getTrustedDevice('device-1')?.lastSeen;
      
      expect(after).toBeGreaterThan(before!);
    });
  });

  describe('配对管理', () => {
    it('应该取消配对', () => {
      const deviceId = 'device-1';
      pairingService.generatePairingCode(deviceId, 'key');
      
      pairingService.cancelPairing(deviceId);
      
      const pairing = pairingService.getActivePairing(deviceId);
      expect(pairing).toBeNull();
    });

    it('应该获取活动配对', () => {
      const deviceId = 'device-1';
      const generated = pairingService.generatePairingCode(deviceId, 'key');
      
      const pairing = pairingService.getActivePairing(deviceId);
      
      expect(pairing).toBeDefined();
      expect(pairing?.code).toBe(generated.code);
    });

    it('应该获取配对剩余时间', () => {
      const deviceId = 'device-1';
      pairingService.generatePairingCode(deviceId, 'key');
      
      const remaining = pairingService.getPairingTimeRemaining(deviceId);
      
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThanOrEqual(300); // 5分钟
    });

    it('不存在的配对剩余时间应该为0', () => {
      const remaining = pairingService.getPairingTimeRemaining('non-existent');
      
      expect(remaining).toBe(0);
    });
  });

  describe('清理和统计', () => {
    it('应该清理过期的配对', () => {
      const deviceId = 'device-1';
      const pairingCode = pairingService.generatePairingCode(deviceId, 'key');
      
      // 模拟过期
      jest.spyOn(Date, 'now').mockReturnValue(pairingCode.expiresAt + 1000);
      
      pairingService.cleanupExpiredPairings();
      
      const pairing = pairingService.getActivePairing(deviceId);
      expect(pairing).toBeNull();
      
      jest.restoreAllMocks();
    });

    it('应该获取配对统计', async () => {
      pairingService.generatePairingCode('device-1', 'key1');
      pairingService.generatePairingCode('device-2', 'key2');
      await pairingService.saveTrustedDevice('device-3', 'Device 3', 'key3');
      
      const stats = pairingService.getPairingStats();
      
      expect(stats.activePairings).toBe(2);
      expect(stats.trustedDevices).toBe(1);
    });
  });
});
