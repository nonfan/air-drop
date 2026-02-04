/**
 * ChunkManager 单元测试
 */
import { ChunkManager, CHUNK_SIZE } from '../services/transfer/ChunkManager';

describe('ChunkManager', () => {
  describe('constructor', () => {
    it('should initialize chunks for small file', () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      const manager = new ChunkManager(file);

      expect(manager.getTotalChunks()).toBe(1);
      expect(manager.getUploadedChunks()).toBe(0);
      expect(manager.getProgress()).toBe(0);
    });

    it('should initialize chunks for large file', () => {
      // Create a file larger than CHUNK_SIZE
      const size = CHUNK_SIZE * 2.5; // 2.5 MB
      const content = new Uint8Array(size);
      const file = new File([content], 'large.bin');
      const manager = new ChunkManager(file);

      expect(manager.getTotalChunks()).toBe(3); // ceil(2.5) = 3
    });

    it('should initialize chunks with correct boundaries', () => {
      const size = CHUNK_SIZE * 2;
      const content = new Uint8Array(size);
      const file = new File([content], 'test.bin');
      const manager = new ChunkManager(file);

      const chunk0 = manager.getChunk(0);
      const chunk1 = manager.getChunk(1);

      expect(chunk0).not.toBeNull();
      expect(chunk1).not.toBeNull();
      expect(chunk0!.start).toBe(0);
      expect(chunk0!.end).toBe(CHUNK_SIZE);
      expect(chunk1!.start).toBe(CHUNK_SIZE);
      expect(chunk1!.end).toBe(CHUNK_SIZE * 2);
    });
  });

  describe('getChunk', () => {
    it('should return chunk by index', () => {
      const file = new File(['test'], 'test.txt');
      const manager = new ChunkManager(file);

      const chunk = manager.getChunk(0);

      expect(chunk).not.toBeNull();
      expect(chunk!.index).toBe(0);
      expect(chunk!.uploaded).toBe(false);
    });

    it('should return null for invalid index', () => {
      const file = new File(['test'], 'test.txt');
      const manager = new ChunkManager(file);

      const chunk = manager.getChunk(999);

      expect(chunk).toBeNull();
    });
  });

  describe('markChunkUploaded', () => {
    it('should mark chunk as uploaded', () => {
      const file = new File(['test'], 'test.txt');
      const manager = new ChunkManager(file);

      manager.markChunkUploaded(0);

      const chunk = manager.getChunk(0);
      expect(chunk!.uploaded).toBe(true);
      expect(manager.getUploadedChunks()).toBe(1);
    });

    it('should handle invalid index gracefully', () => {
      const file = new File(['test'], 'test.txt');
      const manager = new ChunkManager(file);

      expect(() => manager.markChunkUploaded(999)).not.toThrow();
      expect(manager.getUploadedChunks()).toBe(0);
    });
  });

  describe('getProgress', () => {
    it('should return 0 for no uploads', () => {
      const file = new File(['test'], 'test.txt');
      const manager = new ChunkManager(file);

      expect(manager.getProgress()).toBe(0);
    });

    it('should return 100 for complete upload', () => {
      const file = new File(['test'], 'test.txt');
      const manager = new ChunkManager(file);

      manager.markChunkUploaded(0);

      expect(manager.getProgress()).toBe(100);
    });

    it('should return correct percentage for partial upload', () => {
      const size = CHUNK_SIZE * 4;
      const content = new Uint8Array(size);
      const file = new File([content], 'test.bin');
      const manager = new ChunkManager(file);

      manager.markChunkUploaded(0);
      manager.markChunkUploaded(1);

      expect(manager.getProgress()).toBe(50); // 2 out of 4
    });
  });

  describe('getRemainingChunks', () => {
    it('should return all chunks initially', () => {
      const size = CHUNK_SIZE * 3;
      const content = new Uint8Array(size);
      const file = new File([content], 'test.bin');
      const manager = new ChunkManager(file);

      const remaining = manager.getRemainingChunks();

      expect(remaining).toHaveLength(3);
    });

    it('should return only non-uploaded chunks', () => {
      const size = CHUNK_SIZE * 3;
      const content = new Uint8Array(size);
      const file = new File([content], 'test.bin');
      const manager = new ChunkManager(file);

      manager.markChunkUploaded(0);
      manager.markChunkUploaded(2);

      const remaining = manager.getRemainingChunks();

      expect(remaining).toHaveLength(1);
      expect(remaining[0].index).toBe(1);
    });
  });

  describe('isComplete', () => {
    it('should return false for incomplete upload', () => {
      const size = CHUNK_SIZE * 2;
      const content = new Uint8Array(size);
      const file = new File([content], 'test.bin');
      const manager = new ChunkManager(file);

      manager.markChunkUploaded(0);

      expect(manager.isComplete()).toBe(false);
    });

    it('should return true for complete upload', () => {
      const file = new File(['test'], 'test.txt');
      const manager = new ChunkManager(file);

      manager.markChunkUploaded(0);

      expect(manager.isComplete()).toBe(true);
    });
  });

  describe('getFileName and getFileSize', () => {
    it('should return correct file name', () => {
      const file = new File(['test'], 'myfile.txt');
      const manager = new ChunkManager(file);

      expect(manager.getFileName()).toBe('myfile.txt');
    });

    it('should return correct file size', () => {
      const content = new Uint8Array(12345);
      const file = new File([content], 'test.bin');
      const manager = new ChunkManager(file);

      expect(manager.getFileSize()).toBe(12345);
    });
  });

  describe('chunk data integrity', () => {
    it('should create chunks with correct data', () => {
      const content = 'Hello World!';
      const file = new File([content], 'test.txt');
      const manager = new ChunkManager(file);

      const chunk = manager.getChunk(0);

      expect(chunk).not.toBeNull();
      expect(chunk!.data.size).toBe(content.length);
    });

    it('should handle empty file', () => {
      const file = new File([], 'empty.txt');
      const manager = new ChunkManager(file);

      expect(manager.getTotalChunks()).toBe(1);
      expect(manager.getFileSize()).toBe(0);
    });
  });
});
