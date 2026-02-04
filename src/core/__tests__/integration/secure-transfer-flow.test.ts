/**
 * 安全传输流程集成测试
 */

import { SecureTransferManager } from '../../services/transfer/SecureTransferManager';
import { CryptoService } from '../../services/security/CryptoService';

describe('安全传输流程集成测试', () => {
  let senderManager: SecureTransferManager;
  let receiverManager: SecureTransferManager;
  let senderKeyPair: { publicKey: string; privateKey: string };
  let receiverKeyPair: { publicKey: string; privateKey: string };

  beforeEach(async () => {
    senderManager = new SecureTransferManager();
    receiverManager = new SecureTransferManager();

    // 生成密钥对
    const cryptoService = new CryptoService();
    senderKeyPair = await cryptoService.generateKeyPair();
    receiverKeyPair = await cryptoService.generateKeyPair();
  });

  describe('设备配对流程', () => {
    it('应该完成完整的配对流程', async () => {
      const senderId = 'sender-device';
      const receiverId = 'receiver-device';

      // 1. 发送方生成配对码
      const pairingCode = await senderManager.pairDevice(
        receiverId,
        'Receiver Device',
        receiverKeyPair.publicKey
      );

      expect(pairingCode).toMatch(/^\d{6}$/);

      // 2. 接收方验证配对码
      const verified = await receiverManager.verifyPairing(
        pairingCode,
        senderId,
        'Sender Device'
      );

      expect(verified).toBe(true);

      // 3. 检查设备是否在受信任列表中
      const trustedDevices = senderManager.getTrustedDevices();
      expect(trustedDevices.some(d => d.deviceId === receiverId)).toBe(true);
    });

    it('错误的配对码应该失败', async () => {
      const senderId = 'sender-device';
      const receiverId = 'receiver-device';

      await senderManager.pairDevice(receiverId, 'Receiver', receiverKeyPair.publicKey);

      const verified = await receiverManager.verifyPairing(
        '000000',
        senderId,
        'Sender'
      );

      expect(verified).toBe(false);
    });

    it('应该授予默认权限', async () => {
      const receiverId = 'receiver-device';

      await senderManager.pairDevice(receiverId, 'Receiver', receiverKeyPair.publicKey);

      const permissions = senderManager.getDevicePermissions(receiverId);
      expect(permissions).toBeDefined();
      expect(permissions?.permissions.length).toBeGreaterThan(0);
    });
  });

  describe('会话建立流程', () => {
    beforeEach(async () => {
      // 先配对设备
      const senderId = 'sender-device';
      const receiverId = 'receiver-device';

      const code = await senderManager.pairDevice(receiverId, 'Receiver', receiverKeyPair.publicKey);
      await receiverManager.verifyPairing(code, senderId, 'Sender');
    });

    it('应该建立安全会话', async () => {
      const receiverId = 'receiver-device';

      const sessionPromise = new Promise((resolve) => {
        senderManager.once('session-established', resolve);
      });

      await senderManager.establishSecureSession(receiverId);

      const session = await sessionPromise;
      expect(session).toBeDefined();
      expect((session as any).deviceId).toBe(receiverId);
      expect((session as any).encryptedKey).toBeDefined();
      expect((session as any).encryptedIV).toBeDefined();
    });

    it('未配对的设备不能建立会话', async () => {
      const unknownDevice = 'unknown-device';

      await expect(
        senderManager.establishSecureSession(unknownDevice)
      ).rejects.toThrow('Device is not trusted');
    });
  });

  describe('安全文件传输流程', () => {
    let senderId: string;
    let receiverId: string;
    let testFile: File;

    beforeEach(async () => {
      senderId = 'sender-device';
      receiverId = 'receiver-device';

      // 配对设备
      const code = await senderManager.pairDevice(receiverId, 'Receiver', receiverKeyPair.publicKey);
      await receiverManager.verifyPairing(code, senderId, 'Sender');

      // 建立会话
      const sessionData = await new Promise<any>((resolve) => {
        senderManager.once('session-established', resolve);
        senderManager.establishSecureSession(receiverId);
      });

      await receiverManager.receiveSessionKey(
        senderId,
        sessionData.encryptedKey,
        sessionData.encryptedIV,
        receiverKeyPair.privateKey
      );

      // 创建测试文件
      testFile = new File(['Hello, World!'], 'test.txt', { type: 'text/plain' });
    });

    it('应该创建加密传输', async () => {
      const transfer = await senderManager.createSecureTransfer(testFile, receiverId, {
        encrypt: true,
        verify: true
      });

      expect(transfer).toBeDefined();
      expect(transfer.encrypted).toBe(true);
      expect(transfer.verified).toBe(true);
      expect(transfer.fileHash).toBeDefined();
    });

    it('未配对的设备不能创建传输', async () => {
      const unknownDevice = 'unknown-device';

      await expect(
        senderManager.createSecureTransfer(testFile, unknownDevice)
      ).rejects.toThrow('not trusted');
    });

    it('应该完成加密传输', async () => {
      const transfer = await senderManager.createSecureTransfer(testFile, receiverId);

      const completedPromise = new Promise((resolve) => {
        senderManager.once('transfer-completed', resolve);
      });

      await senderManager.start(transfer.id, testFile);

      const completed = await completedPromise;
      expect(completed).toBeDefined();
      expect((completed as any).status).toBe('completed');
    });

    it('应该触发加密事件', async () => {
      const transfer = await senderManager.createSecureTransfer(testFile, receiverId, {
        encrypt: true
      });

      const encryptingPromise = new Promise((resolve) => {
        senderManager.once('transfer-encrypting', resolve);
      });

      senderManager.start(transfer.id, testFile);

      const encrypting = await encryptingPromise;
      expect(encrypting).toBeDefined();
    });

    it('应该计算文件哈希', async () => {
      const transfer = await senderManager.createSecureTransfer(testFile, receiverId, {
        verify: true
      });

      expect(transfer.fileHash).toBeDefined();
      expect(transfer.fileHash).toHaveLength(64); // SHA-256
    });
  });

  describe('权限管理', () => {
    let deviceId: string;

    beforeEach(async () => {
      deviceId = 'test-device';
      const code = await senderManager.pairDevice(deviceId, 'Test Device', receiverKeyPair.publicKey);
      await receiverManager.verifyPairing(code, 'sender', 'Sender');
    });

    it('应该授予权限', () => {
      const grantedPromise = new Promise((resolve) => {
        senderManager.once('permission-granted', resolve);
      });

      senderManager.grantPermission(deviceId, 'delete' as any);

      return expect(grantedPromise).resolves.toBeDefined();
    });

    it('应该撤销权限', () => {
      const revokedPromise = new Promise((resolve) => {
        senderManager.once('permission-revoked', resolve);
      });

      senderManager.revokePermission(deviceId, 'write' as any);

      return expect(revokedPromise).resolves.toBeDefined();
    });

    it('应该获取设备权限', () => {
      const permissions = senderManager.getDevicePermissions(deviceId);

      expect(permissions).toBeDefined();
      expect(permissions?.deviceId).toBe(deviceId);
    });
  });

  describe('设备管理', () => {
    it('应该移除受信任设备', async () => {
      const deviceId = 'test-device';
      const code = await senderManager.pairDevice(deviceId, 'Test Device', receiverKeyPair.publicKey);
      await receiverManager.verifyPairing(code, 'sender', 'Sender');

      const removedPromise = new Promise((resolve) => {
        senderManager.once('device-removed', resolve);
      });

      await senderManager.removeTrustedDevice(deviceId);

      const removed = await removedPromise;
      expect(removed).toBeDefined();
      expect((removed as any).deviceId).toBe(deviceId);

      // 验证设备已被移除
      const trustedDevices = senderManager.getTrustedDevices();
      expect(trustedDevices.some(d => d.deviceId === deviceId)).toBe(false);
    });

    it('应该获取受信任设备列表', async () => {
      const device1 = 'device-1';
      const device2 = 'device-2';

      const code1 = await senderManager.pairDevice(device1, 'Device 1', receiverKeyPair.publicKey);
      await receiverManager.verifyPairing(code1, 'sender', 'Sender');

      const code2 = await senderManager.pairDevice(device2, 'Device 2', receiverKeyPair.publicKey);
      await receiverManager.verifyPairing(code2, 'sender', 'Sender');

      const devices = senderManager.getTrustedDevices();
      expect(devices.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('错误处理', () => {
    it('没有会话密钥时传输应该失败', async () => {
      const deviceId = 'test-device';
      const code = await senderManager.pairDevice(deviceId, 'Test Device', receiverKeyPair.publicKey);
      await receiverManager.verifyPairing(code, 'sender', 'Sender');

      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const transfer = await senderManager.createSecureTransfer(testFile, deviceId);

      await expect(
        senderManager.start(transfer.id, testFile)
      ).rejects.toThrow('Session key not found');
    });

    it('应该处理传输失败', async () => {
      const deviceId = 'test-device';
      const code = await senderManager.pairDevice(deviceId, 'Test Device', receiverKeyPair.publicKey);
      await receiverManager.verifyPairing(code, 'sender', 'Sender');

      // 建立会话
      const sessionData = await new Promise<any>((resolve) => {
        senderManager.once('session-established', resolve);
        senderManager.establishSecureSession(deviceId);
      });

      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const transfer = await senderManager.createSecureTransfer(testFile, deviceId);

      const failedPromise = new Promise((resolve) => {
        senderManager.once('transfer-failed', resolve);
      });

      // 模拟失败（通过传入无效文件）
      try {
        await senderManager.start('invalid-id', testFile);
      } catch (error) {
        // 预期会失败
      }
    });
  });

  describe('传输控制', () => {
    let deviceId: string;
    let testFile: File;

    beforeEach(async () => {
      deviceId = 'test-device';
      const code = await senderManager.pairDevice(deviceId, 'Test Device', receiverKeyPair.publicKey);
      await receiverManager.verifyPairing(code, 'sender', 'Sender');

      const sessionData = await new Promise<any>((resolve) => {
        senderManager.once('session-established', resolve);
        senderManager.establishSecureSession(deviceId);
      });

      testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    });

    it('应该暂停传输', async () => {
      const transfer = await senderManager.createSecureTransfer(testFile, deviceId);

      const pausedPromise = new Promise((resolve) => {
        senderManager.once('transfer-paused', resolve);
      });

      senderManager.start(transfer.id, testFile);
      
      // 等待一小段时间后暂停
      await new Promise(resolve => setTimeout(resolve, 50));
      senderManager.pause(transfer.id);

      const paused = await pausedPromise;
      expect(paused).toBeDefined();
      expect((paused as any).status).toBe('paused');
    });

    it('应该取消传输', async () => {
      const transfer = await senderManager.createSecureTransfer(testFile, deviceId);

      const cancelledPromise = new Promise((resolve) => {
        senderManager.once('transfer-cancelled', resolve);
      });

      senderManager.start(transfer.id, testFile);
      senderManager.cancel(transfer.id);

      const cancelled = await cancelledPromise;
      expect(cancelled).toBeDefined();
      expect((cancelled as any).status).toBe('failed');
    });

    it('应该获取活动传输', async () => {
      const transfer = await senderManager.createSecureTransfer(testFile, deviceId);
      senderManager.start(transfer.id, testFile);

      const activeTransfers = senderManager.getActiveTransfers();
      expect(activeTransfers.length).toBeGreaterThan(0);
    });
  });
});
