/**
 * IntegrityService 单元测试
 */

import { IntegrityService } from '../services/security/IntegrityService';
import { CryptoService } from '../services/security/CryptoService';

describe('IntegrityService', () => {
  let integrityService: IntegrityService;
  let cryptoService: CryptoService;

  beforeEach(() => {
    integrityService = new IntegrityService();
    cryptoService = new CryptoService();
  });

  describe('文件哈希计算', () => {
    it('应该计算文件哈希', async () => {
      const content = 'Hello, World!';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      
      const hash = await integrityService.calculateFileHash(file);
      
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64); // SHA-256 产生 64 个十六进制字符
    });

    it('相同内容应该产生相同的哈希', async () => {
      const content = 'Test content';
      const file1 = new File([content], 'test1.txt', { type: 'text/plain' });
      const file2 = new File([content], 'test2.txt', { type: 'text/plain' });
      
      const hash1 = await integrityService.calculateFileHash(file1);
      const hash2 = await integrityService.calculateFileHash(file2);
      
      expect(hash1).toBe(hash2);
    });

    it('不同内容应该产生不同的哈希', async () => {
      const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' });
      const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' });
      
      const hash1 = await integrityService.calculateFileHash(file1);
      const hash2 = await integrityService.calculateFileHash(file2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('应该处理空文件', async () => {
      const emptyFile = new File([], 'empty.txt', { type: 'text/plain' });
      
      const hash = await integrityService.calculateFileHash(emptyFile);
      
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });

    it('应该处理大文件', async () => {
      const largeContent = 'x'.repeat(1024 * 1024); // 1MB
      const largeFile = new File([largeContent], 'large.txt', { type: 'text/plain' });
      
      const hash = await integrityService.calculateFileHash(largeFile);
      
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });
  });

  describe('文件完整性验证', () => {
    it('应该验证文件完整性', async () => {
      const content = 'Test content';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      
      const hash = await integrityService.calculateFileHash(file);
      const isValid = await integrityService.verifyFileIntegrity(file, hash);
      
      expect(isValid).toBe(true);
    });

    it('修改后的文件应该验证失败', async () => {
      const originalFile = new File(['original'], 'test.txt', { type: 'text/plain' });
      const modifiedFile = new File(['modified'], 'test.txt', { type: 'text/plain' });
      
      const hash = await integrityService.calculateFileHash(originalFile);
      const isValid = await integrityService.verifyFileIntegrity(modifiedFile, hash);
      
      expect(isValid).toBe(false);
    });

    it('错误的哈希应该验证失败', async () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      const wrongHash = 'a'.repeat(64);
      
      const isValid = await integrityService.verifyFileIntegrity(file, wrongHash);
      
      expect(isValid).toBe(false);
    });
  });

  describe('分片哈希计算', () => {
    it('应该计算分片哈希', async () => {
      const chunk = new Blob(['chunk data']);
      
      const hash = await integrityService.calculateChunkHash(chunk);
      
      expect(hash).toBeDefined();
      expect(hash).toHaveLength(64);
    });

    it('相同分片应该产生相同的哈希', async () => {
      const chunk1 = new Blob(['same data']);
      const chunk2 = new Blob(['same data']);
      
      const hash1 = await integrityService.calculateChunkHash(chunk1);
      const hash2 = await integrityService.calculateChunkHash(chunk2);
      
      expect(hash1).toBe(hash2);
    });

    it('不同分片应该产生不同的哈希', async () => {
      const chunk1 = new Blob(['data1']);
      const chunk2 = new Blob(['data2']);
      
      const hash1 = await integrityService.calculateChunkHash(chunk1);
      const hash2 = await integrityService.calculateChunkHash(chunk2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('数字签名', () => {
    let keyPair: { publicKey: string; privateKey: string };
    let testData: ArrayBuffer;

    beforeEach(async () => {
      keyPair = await cryptoService.generateKeyPair();
      testData = new TextEncoder().encode('Test data for signing').buffer;
    });

    it('应该签名数据', async () => {
      const signature = await integrityService.signData(testData, keyPair.privateKey);
      
      expect(signature).toBeDefined();
      expect(signature.length).toBeGreaterThan(0);
    });

    it('应该验证签名', async () => {
      const signature = await integrityService.signData(testData, keyPair.privateKey);
      const isValid = await integrityService.verifySignature(
        testData,
        signature,
        keyPair.publicKey
      );
      
      expect(isValid).toBe(true);
    });

    it('修改后的数据应该验证失败', async () => {
      const signature = await integrityService.signData(testData, keyPair.privateKey);
      const modifiedData = new TextEncoder().encode('Modified data').buffer;
      
      const isValid = await integrityService.verifySignature(
        modifiedData,
        signature,
        keyPair.publicKey
      );
      
      expect(isValid).toBe(false);
    });

    it('错误的签名应该验证失败', async () => {
      const wrongSignature = 'invalid-signature';
      
      await expect(
        integrityService.verifySignature(testData, wrongSignature, keyPair.publicKey)
      ).rejects.toThrow();
    });

    it('使用错误的公钥应该验证失败', async () => {
      const signature = await integrityService.signData(testData, keyPair.privateKey);
      const wrongKeyPair = await cryptoService.generateKeyPair();
      
      const isValid = await integrityService.verifySignature(
        testData,
        signature,
        wrongKeyPair.publicKey
      );
      
      expect(isValid).toBe(false);
    });

    it('应该处理空数据', async () => {
      const emptyData = new ArrayBuffer(0);
      
      const signature = await integrityService.signData(emptyData, keyPair.privateKey);
      const isValid = await integrityService.verifySignature(
        emptyData,
        signature,
        keyPair.publicKey
      );
      
      expect(isValid).toBe(true);
    });

    it('应该处理大数据', async () => {
      const largeData = new Uint8Array(1024 * 1024).fill(42).buffer; // 1MB
      
      const signature = await integrityService.signData(largeData, keyPair.privateKey);
      const isValid = await integrityService.verifySignature(
        largeData,
        signature,
        keyPair.publicKey
      );
      
      expect(isValid).toBe(true);
    });
  });

  describe('哈希一致性', () => {
    it('文件哈希和分片哈希应该一致', async () => {
      const content = 'Test content';
      const file = new File([content], 'test.txt', { type: 'text/plain' });
      const blob = new Blob([content]);
      
      const fileHash = await integrityService.calculateFileHash(file);
      const chunkHash = await integrityService.calculateChunkHash(blob);
      
      expect(fileHash).toBe(chunkHash);
    });
  });
});
