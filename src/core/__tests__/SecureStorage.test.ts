/**
 * SecureStorage 单元测试
 */

import { SecureStorage } from '../services/security/SecureStorage';
import { SessionKey } from '../services/security/CryptoService';

describe('SecureStorage', () => {
  let secureStorage: SecureStorage;

  beforeEach(() => {
    secureStorage = new SecureStorage();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('私钥存储', () => {
    const testPrivateKey = '-----BEGIN PRIVATE KEY-----\ntest-key-data\n-----END PRIVATE KEY-----';
    const testPassword = 'test-password-123';

    it('应该存储私钥', async () => {
      await secureStorage.storePrivateKey(testPrivateKey, testPassword);
      
      expect(secureStorage.hasPrivateKey()).toBe(true);
    });

    it('应该读取私钥', async () => {
      await secureStorage.storePrivateKey(testPrivateKey, testPassword);
      
      const retrieved = await secureStorage.retrievePrivateKey(testPassword);
      
      expect(retrieved).toBe(testPrivateKey);
    });

    it('错误的密码应该无法读取私钥', async () => {
      await secureStorage.storePrivateKey(testPrivateKey, testPassword);
      
      await expect(
        secureStorage.retrievePrivateKey('wrong-password')
      ).rejects.toThrow();
    });

    it('不存在的私钥应该抛出错误', async () => {
      await expect(
        secureStorage.retrievePrivateKey(testPassword)
      ).rejects.toThrow('Private key not found');
    });

    it('应该验证密码', async () => {
      await secureStorage.storePrivateKey(testPrivateKey, testPassword);
      
      expect(await secureStorage.verifyPassword(testPassword)).toBe(true);
      expect(await secureStorage.verifyPassword('wrong-password')).toBe(false);
    });

    it('应该更改密码', async () => {
      const oldPassword = 'old-password';
      const newPassword = 'new-password';
      
      await secureStorage.storePrivateKey(testPrivateKey, oldPassword);
      await secureStorage.changePassword(oldPassword, newPassword);
      
      const retrieved = await secureStorage.retrievePrivateKey(newPassword);
      expect(retrieved).toBe(testPrivateKey);
      
      await expect(
        secureStorage.retrievePrivateKey(oldPassword)
      ).rejects.toThrow();
    });
  });

  describe('会话密钥存储', () => {
    const testSessionKey: SessionKey = {
      key: new Uint8Array([1, 2, 3, 4, 5]),
      iv: new Uint8Array([6, 7, 8, 9, 10]),
      expiresAt: Date.now() + 60000
    };

    it('应该存储会话密钥', async () => {
      await secureStorage.storeSessionKey('device-1', testSessionKey);
      
      const retrieved = await secureStorage.retrieveSessionKey('device-1');
      
      expect(retrieved).toBeDefined();
      expect(Array.from(retrieved!.key)).toEqual(Array.from(testSessionKey.key));
      expect(Array.from(retrieved!.iv)).toEqual(Array.from(testSessionKey.iv));
    });

    it('应该读取会话密钥', async () => {
      await secureStorage.storeSessionKey('device-1', testSessionKey);
      
      const retrieved = await secureStorage.retrieveSessionKey('device-1');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.expiresAt).toBe(testSessionKey.expiresAt);
    });

    it('不存在的会话密钥应该返回 null', async () => {
      const retrieved = await secureStorage.retrieveSessionKey('non-existent');
      
      expect(retrieved).toBeNull();
    });

    it('过期的会话密钥应该返回 null', async () => {
      const expiredKey: SessionKey = {
        key: new Uint8Array([1, 2, 3]),
        iv: new Uint8Array([4, 5, 6]),
        expiresAt: Date.now() - 1000 // 已过期
      };
      
      await secureStorage.storeSessionKey('device-1', expiredKey);
      
      const retrieved = await secureStorage.retrieveSessionKey('device-1');
      
      expect(retrieved).toBeNull();
    });

    it('应该删除会话密钥', async () => {
      await secureStorage.storeSessionKey('device-1', testSessionKey);
      await secureStorage.removeSessionKey('device-1');
      
      const retrieved = await secureStorage.retrieveSessionKey('device-1');
      
      expect(retrieved).toBeNull();
    });

    it('应该存储多个设备的会话密钥', async () => {
      const key1: SessionKey = {
        key: new Uint8Array([1, 2, 3]),
        iv: new Uint8Array([4, 5, 6]),
        expiresAt: Date.now() + 60000
      };
      
      const key2: SessionKey = {
        key: new Uint8Array([7, 8, 9]),
        iv: new Uint8Array([10, 11, 12]),
        expiresAt: Date.now() + 60000
      };
      
      await secureStorage.storeSessionKey('device-1', key1);
      await secureStorage.storeSessionKey('device-2', key2);
      
      const retrieved1 = await secureStorage.retrieveSessionKey('device-1');
      const retrieved2 = await secureStorage.retrieveSessionKey('device-2');
      
      expect(Array.from(retrieved1!.key)).toEqual(Array.from(key1.key));
      expect(Array.from(retrieved2!.key)).toEqual(Array.from(key2.key));
    });
  });

  describe('清理操作', () => {
    it('应该清除所有密钥', async () => {
      const privateKey = 'test-private-key';
      const password = 'test-password';
      const sessionKey: SessionKey = {
        key: new Uint8Array([1, 2, 3]),
        iv: new Uint8Array([4, 5, 6]),
        expiresAt: Date.now() + 60000
      };
      
      await secureStorage.storePrivateKey(privateKey, password);
      await secureStorage.storeSessionKey('device-1', sessionKey);
      
      await secureStorage.clearAllKeys();
      
      expect(secureStorage.hasPrivateKey()).toBe(false);
      expect(await secureStorage.retrieveSessionKey('device-1')).toBeNull();
    });

    it('应该清理过期的会话密钥', async () => {
      const validKey: SessionKey = {
        key: new Uint8Array([1, 2, 3]),
        iv: new Uint8Array([4, 5, 6]),
        expiresAt: Date.now() + 60000
      };
      
      const expiredKey: SessionKey = {
        key: new Uint8Array([7, 8, 9]),
        iv: new Uint8Array([10, 11, 12]),
        expiresAt: Date.now() - 1000
      };
      
      await secureStorage.storeSessionKey('device-1', validKey);
      await secureStorage.storeSessionKey('device-2', expiredKey);
      
      const cleaned = await secureStorage.cleanupExpiredSessionKeys();
      
      expect(cleaned).toBe(1);
      expect(await secureStorage.retrieveSessionKey('device-1')).toBeDefined();
      expect(await secureStorage.retrieveSessionKey('device-2')).toBeNull();
    });

    it('应该清理无效的会话密钥数据', async () => {
      // 手动添加无效数据
      localStorage.setItem('session_key_invalid', 'invalid-json-data');
      
      const cleaned = await secureStorage.cleanupExpiredSessionKeys();
      
      expect(cleaned).toBe(1);
      expect(localStorage.getItem('session_key_invalid')).toBeNull();
    });
  });

  describe('存储统计', () => {
    it('应该获取存储统计', async () => {
      const privateKey = 'test-private-key';
      const password = 'test-password';
      const sessionKey: SessionKey = {
        key: new Uint8Array([1, 2, 3]),
        iv: new Uint8Array([4, 5, 6]),
        expiresAt: Date.now() + 60000
      };
      
      await secureStorage.storePrivateKey(privateKey, password);
      await secureStorage.storeSessionKey('device-1', sessionKey);
      await secureStorage.storeSessionKey('device-2', sessionKey);
      
      const stats = secureStorage.getStorageStats();
      
      expect(stats.hasPrivateKey).toBe(true);
      expect(stats.sessionKeyCount).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('空存储应该返回零统计', () => {
      const stats = secureStorage.getStorageStats();
      
      expect(stats.hasPrivateKey).toBe(false);
      expect(stats.sessionKeyCount).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('加密安全性', () => {
    it('存储的数据应该是加密的', async () => {
      const privateKey = 'test-private-key';
      const password = 'test-password';
      
      await secureStorage.storePrivateKey(privateKey, password);
      
      const stored = localStorage.getItem('encrypted_private_key');
      
      expect(stored).toBeDefined();
      expect(stored).not.toContain(privateKey);
    });

    it('相同数据使用不同密码应该产生不同的加密结果', async () => {
      const privateKey = 'test-private-key';
      
      await secureStorage.storePrivateKey(privateKey, 'password1');
      const encrypted1 = localStorage.getItem('encrypted_private_key');
      
      await secureStorage.storePrivateKey(privateKey, 'password2');
      const encrypted2 = localStorage.getItem('encrypted_private_key');
      
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('相同数据和密码多次加密应该产生不同结果（使用随机IV）', async () => {
      const privateKey = 'test-private-key';
      const password = 'test-password';
      
      await secureStorage.storePrivateKey(privateKey, password);
      const encrypted1 = localStorage.getItem('encrypted_private_key');
      
      await secureStorage.storePrivateKey(privateKey, password);
      const encrypted2 = localStorage.getItem('encrypted_private_key');
      
      expect(encrypted1).not.toBe(encrypted2);
    });
  });
});
