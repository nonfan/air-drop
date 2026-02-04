/**
 * CryptoService 单元测试
 */

import { CryptoService, KeyPair, SessionKey } from '../services/security/CryptoService';

describe('CryptoService', () => {
  let cryptoService: CryptoService;

  beforeEach(() => {
    cryptoService = new CryptoService();
  });

  describe('密钥生成', () => {
    it('应该生成 RSA 密钥对', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      
      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toContain('BEGIN PUBLIC KEY');
      expect(keyPair.privateKey).toContain('BEGIN PRIVATE KEY');
    });

    it('应该生成会话密钥', async () => {
      const sessionKey = await cryptoService.generateSessionKey();
      
      expect(sessionKey).toBeDefined();
      expect(sessionKey.key).toHaveLength(32); // 256 bits
      expect(sessionKey.iv).toHaveLength(12);  // 96 bits
      expect(sessionKey.expiresAt).toBeGreaterThan(Date.now());
    });

    it('每次生成的会话密钥应该不同', async () => {
      const key1 = await cryptoService.generateSessionKey();
      const key2 = await cryptoService.generateSessionKey();
      
      expect(key1.key).not.toEqual(key2.key);
      expect(key1.iv).not.toEqual(key2.iv);
    });
  });

  describe('文件加密和解密', () => {
    let sessionKey: SessionKey;
    let testFile: File;

    beforeEach(async () => {
      sessionKey = await cryptoService.generateSessionKey();
      const content = 'Hello, World! This is a test file.';
      testFile = new File([content], 'test.txt', { type: 'text/plain' });
    });

    it('应该加密文件', async () => {
      const encrypted = await cryptoService.encryptFile(testFile, sessionKey);
      
      expect(encrypted).toBeInstanceOf(Blob);
      expect(encrypted.size).toBeGreaterThan(0);
    });

    it('应该解密文件', async () => {
      const encrypted = await cryptoService.encryptFile(testFile, sessionKey);
      const decrypted = await cryptoService.decryptFile(encrypted, sessionKey);
      
      expect(decrypted).toBeInstanceOf(Blob);
      
      const decryptedText = await decrypted.text();
      const originalText = await testFile.text();
      expect(decryptedText).toBe(originalText);
    });

    it('加密后的数据应该与原始数据不同', async () => {
      const encrypted = await cryptoService.encryptFile(testFile, sessionKey);
      
      const encryptedText = await encrypted.text();
      const originalText = await testFile.text();
      expect(encryptedText).not.toBe(originalText);
    });

    it('使用错误的密钥解密应该失败', async () => {
      const encrypted = await cryptoService.encryptFile(testFile, sessionKey);
      const wrongKey = await cryptoService.generateSessionKey();
      
      await expect(
        cryptoService.decryptFile(encrypted, wrongKey)
      ).rejects.toThrow();
    });

    it('应该处理空文件', async () => {
      const emptyFile = new File([], 'empty.txt', { type: 'text/plain' });
      
      const encrypted = await cryptoService.encryptFile(emptyFile, sessionKey);
      const decrypted = await cryptoService.decryptFile(encrypted, sessionKey);
      
      expect(decrypted.size).toBe(0);
    });

    it('应该处理大文件', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      const largeFile = new File([largeContent], 'large.txt', { type: 'text/plain' });
      
      const encrypted = await cryptoService.encryptFile(largeFile, sessionKey);
      const decrypted = await cryptoService.decryptFile(encrypted, sessionKey);
      
      const decryptedText = await decrypted.text();
      expect(decryptedText).toBe(largeContent);
    });
  });

  describe('密钥导入和导出', () => {
    it('应该导出和导入公钥', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      const importedKey = await cryptoService.importPublicKey(keyPair.publicKey);
      
      expect(importedKey).toBeDefined();
      expect(importedKey.type).toBe('public');
    });

    it('应该导出和导入私钥', async () => {
      const keyPair = await cryptoService.generateKeyPair();
      const importedKey = await cryptoService.importPrivateKey(keyPair.privateKey);
      
      expect(importedKey).toBeDefined();
      expect(importedKey.type).toBe('private');
    });

    it('导入无效的公钥应该失败', async () => {
      const invalidKey = 'invalid-key';
      
      await expect(
        cryptoService.importPublicKey(invalidKey)
      ).rejects.toThrow();
    });

    it('导入无效的私钥应该失败', async () => {
      const invalidKey = 'invalid-key';
      
      await expect(
        cryptoService.importPrivateKey(invalidKey)
      ).rejects.toThrow();
    });
  });

  describe('工具方法', () => {
    it('应该将 ArrayBuffer 转换为 Base64', () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer;
      const base64 = cryptoService.arrayBufferToBase64(buffer);
      
      expect(base64).toBe('SGVsbG8=');
    });

    it('应该将 Base64 转换为 ArrayBuffer', () => {
      const base64 = 'SGVsbG8=';
      const buffer = cryptoService.base64ToArrayBuffer(base64);
      const bytes = new Uint8Array(buffer);
      
      expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
    });

    it('Base64 转换应该是可逆的', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5]).buffer;
      const base64 = cryptoService.arrayBufferToBase64(original);
      const restored = cryptoService.base64ToArrayBuffer(base64);
      
      expect(new Uint8Array(restored)).toEqual(new Uint8Array(original));
    });
  });

  describe('会话密钥过期', () => {
    it('会话密钥应该在 24 小时后过期', async () => {
      const sessionKey = await cryptoService.generateSessionKey();
      const expectedExpiry = Date.now() + 24 * 60 * 60 * 1000;
      
      expect(sessionKey.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 1000);
      expect(sessionKey.expiresAt).toBeLessThanOrEqual(expectedExpiry + 1000);
    });
  });
});
