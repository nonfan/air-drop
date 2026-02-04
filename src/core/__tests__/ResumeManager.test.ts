/**
 * ResumeManager 单元测试
 */
import { ResumeManager } from '../services/transfer/ResumeManager';

describe('ResumeManager', () => {
  let manager: ResumeManager;

  beforeEach(async () => {
    manager = new ResumeManager();
    await manager.initialize();
  });

  afterEach(async () => {
    // Clean up all transfers
    const transfers = await manager.getAllTransfers();
    for (const transfer of transfers) {
      await manager.deleteTransferState(transfer.id);
    }
  });

  describe('initialize', () => {
    it('should initialize database', async () => {
      const newManager = new ResumeManager();
      await expect(newManager.initialize()).resolves.not.toThrow();
    });

    it('should allow multiple initializations', async () => {
      await expect(manager.initialize()).resolves.not.toThrow();
    });
  });

  describe('saveTransferState', () => {
    it('should save transfer state', async () => {
      await manager.saveTransferState(
        'transfer-1',
        'test.txt',
        1024,
        [0, 1, 2],
        10
      );

      const state = await manager.loadTransferState('transfer-1');

      expect(state).toBeDefined();
      expect(state?.id).toBe('transfer-1');
      expect(state?.fileName).toBe('test.txt');
      expect(state?.fileSize).toBe(1024);
      expect(state?.uploadedChunks).toEqual([0, 1, 2]);
      expect(state?.totalChunks).toBe(10);
    });

    it('should update existing transfer state', async () => {
      await manager.saveTransferState(
        'transfer-1',
        'test.txt',
        1024,
        [0, 1],
        10
      );

      await manager.saveTransferState(
        'transfer-1',
        'test.txt',
        1024,
        [0, 1, 2, 3],
        10
      );

      const state = await manager.loadTransferState('transfer-1');

      expect(state?.uploadedChunks).toEqual([0, 1, 2, 3]);
    });

    it('should set timestamps', async () => {
      const before = Date.now();
      
      await manager.saveTransferState(
        'transfer-1',
        'test.txt',
        1024,
        [0],
        10
      );

      const after = Date.now();
      const state = await manager.loadTransferState('transfer-1');

      expect(state?.createdAt).toBeGreaterThanOrEqual(before);
      expect(state?.createdAt).toBeLessThanOrEqual(after);
      expect(state?.updatedAt).toBeGreaterThanOrEqual(before);
      expect(state?.updatedAt).toBeLessThanOrEqual(after);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new ResumeManager();

      await expect(
        uninitializedManager.saveTransferState('id', 'file', 100, [], 1)
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('loadTransferState', () => {
    it('should load existing transfer state', async () => {
      await manager.saveTransferState(
        'transfer-1',
        'test.txt',
        1024,
        [0, 1, 2],
        10
      );

      const state = await manager.loadTransferState('transfer-1');

      expect(state).toBeDefined();
      expect(state?.id).toBe('transfer-1');
    });

    it('should return undefined for non-existent transfer', async () => {
      const state = await manager.loadTransferState('non-existent');

      expect(state).toBeUndefined();
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new ResumeManager();

      await expect(
        uninitializedManager.loadTransferState('id')
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('deleteTransferState', () => {
    it('should delete transfer state', async () => {
      await manager.saveTransferState(
        'transfer-1',
        'test.txt',
        1024,
        [0, 1],
        10
      );

      await manager.deleteTransferState('transfer-1');

      const state = await manager.loadTransferState('transfer-1');
      expect(state).toBeUndefined();
    });

    it('should not throw error for non-existent transfer', async () => {
      await expect(
        manager.deleteTransferState('non-existent')
      ).resolves.not.toThrow();
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new ResumeManager();

      await expect(
        uninitializedManager.deleteTransferState('id')
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('getAllTransfers', () => {
    it('should return empty array initially', async () => {
      const transfers = await manager.getAllTransfers();

      expect(transfers).toEqual([]);
    });

    it('should return all transfers', async () => {
      await manager.saveTransferState('transfer-1', 'file1.txt', 100, [0], 5);
      await manager.saveTransferState('transfer-2', 'file2.txt', 200, [0, 1], 5);
      await manager.saveTransferState('transfer-3', 'file3.txt', 300, [0, 1, 2], 5);

      const transfers = await manager.getAllTransfers();

      expect(transfers).toHaveLength(3);
      expect(transfers.map(t => t.id)).toContain('transfer-1');
      expect(transfers.map(t => t.id)).toContain('transfer-2');
      expect(transfers.map(t => t.id)).toContain('transfer-3');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new ResumeManager();

      await expect(
        uninitializedManager.getAllTransfers()
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('clearOldTransfers', () => {
    it('should clear old transfers', async () => {
      // Save a transfer with old timestamp
      await manager.saveTransferState('old-transfer', 'old.txt', 100, [0], 5);
      
      // Manually update the timestamp to be old
      const state = await manager.loadTransferState('old-transfer');
      if (state) {
        state.updatedAt = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago
        await manager.saveTransferState(
          state.id,
          state.fileName,
          state.fileSize,
          state.uploadedChunks,
          state.totalChunks
        );
      }

      // Save a recent transfer
      await manager.saveTransferState('recent-transfer', 'recent.txt', 100, [0], 5);

      await manager.clearOldTransfers(7 * 24 * 60 * 60 * 1000); // 7 days

      const transfers = await manager.getAllTransfers();

      expect(transfers).toHaveLength(1);
      expect(transfers[0].id).toBe('recent-transfer');
    });

    it('should use default max age', async () => {
      await manager.saveTransferState('transfer-1', 'file.txt', 100, [0], 5);

      await manager.clearOldTransfers();

      const transfers = await manager.getAllTransfers();
      expect(transfers).toHaveLength(1);
    });

    it('should not delete recent transfers', async () => {
      await manager.saveTransferState('transfer-1', 'file1.txt', 100, [0], 5);
      await manager.saveTransferState('transfer-2', 'file2.txt', 200, [0], 5);

      await manager.clearOldTransfers(1000); // 1 second

      const transfers = await manager.getAllTransfers();
      expect(transfers.length).toBeGreaterThan(0);
    });

    it('should throw error if not initialized', async () => {
      const uninitializedManager = new ResumeManager();

      await expect(
        uninitializedManager.clearOldTransfers()
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('resume workflow', () => {
    it('should support complete resume workflow', async () => {
      // 1. Save initial state
      await manager.saveTransferState(
        'transfer-1',
        'large-file.bin',
        10485760, // 10MB
        [0, 1, 2],
        100
      );

      // 2. Load state
      const state1 = await manager.loadTransferState('transfer-1');
      expect(state1?.uploadedChunks).toEqual([0, 1, 2]);

      // 3. Update progress
      await manager.saveTransferState(
        'transfer-1',
        'large-file.bin',
        10485760,
        [0, 1, 2, 3, 4, 5],
        100
      );

      // 4. Load updated state
      const state2 = await manager.loadTransferState('transfer-1');
      expect(state2?.uploadedChunks).toEqual([0, 1, 2, 3, 4, 5]);

      // 5. Complete transfer and delete
      await manager.deleteTransferState('transfer-1');

      // 6. Verify deletion
      const state3 = await manager.loadTransferState('transfer-1');
      expect(state3).toBeUndefined();
    });
  });

  describe('concurrent operations', () => {
    it('should handle concurrent saves', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        manager.saveTransferState(
          `transfer-${i}`,
          `file-${i}.txt`,
          1024 * i,
          [0],
          10
        )
      );

      await Promise.all(promises);

      const transfers = await manager.getAllTransfers();
      expect(transfers).toHaveLength(10);
    });

    it('should handle concurrent reads', async () => {
      await manager.saveTransferState('transfer-1', 'file.txt', 1024, [0], 10);

      const promises = Array.from({ length: 10 }, () =>
        manager.loadTransferState('transfer-1')
      );

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result?.id).toBe('transfer-1');
      });
    });
  });

  describe('edge cases', () => {
    it('should handle empty uploaded chunks', async () => {
      await manager.saveTransferState('transfer-1', 'file.txt', 1024, [], 10);

      const state = await manager.loadTransferState('transfer-1');

      expect(state?.uploadedChunks).toEqual([]);
    });

    it('should handle large chunk arrays', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);

      await manager.saveTransferState(
        'transfer-1',
        'huge-file.bin',
        1024 * 1024 * 1024,
        largeArray,
        10000
      );

      const state = await manager.loadTransferState('transfer-1');

      expect(state?.uploadedChunks).toHaveLength(10000);
    });

    it('should handle special characters in file names', async () => {
      const specialName = '文件名 with spaces & special!@#$%^&*().txt';

      await manager.saveTransferState(
        'transfer-1',
        specialName,
        1024,
        [0],
        10
      );

      const state = await manager.loadTransferState('transfer-1');

      expect(state?.fileName).toBe(specialName);
    });
  });
});
