/**
 * 端到端传输流程集成测试
 */
import { TransferManager } from '../../services/transfer/TransferManager';
import { ChunkManager } from '../../services/transfer/ChunkManager';
import { ProgressTracker } from '../../services/transfer/ProgressTracker';
import { ResumeManager } from '../../services/transfer/ResumeManager';
import { cleanupIntegrationTest } from './setup';

describe('Transfer Flow Integration', () => {
  let transferManager: TransferManager;
  let resumeManager: ResumeManager;

  beforeEach(async () => {
    transferManager = new TransferManager();
    resumeManager = new ResumeManager();
    await resumeManager.initialize();
  });

  afterEach(async () => {
    transferManager.removeAllListeners();
    await cleanupIntegrationTest();
  });

  describe('Complete Transfer Flow', () => {
    it('should handle complete file transfer workflow', async () => {
      // 1. Create a file
      const fileContent = 'Test file content for transfer';
      const file = new File([fileContent], 'test.txt', { type: 'text/plain' });

      // 2. Create transfer
      const transfer = transferManager.createTransfer(file, 'device-1');
      expect(transfer.status).toBe('pending');

      // 3. Start transfer
      const startPromise = transferManager.start(transfer.id);
      expect(transfer.status).toBe('active');

      // 4. Wait for completion
      await startPromise;
      expect(transfer.status).toBe('completed');
      expect(transfer.progress).toBe(100);
    });

    it('should handle pause and resume', async () => {
      const file = new File(['test content'], 'test.txt');
      const transfer = transferManager.createTransfer(file, 'device-1');

      // Start transfer
      transferManager.start(transfer.id);
      expect(transfer.status).toBe('active');

      // Pause transfer
      transferManager.pause(transfer.id);
      expect(transfer.status).toBe('paused');

      // Resume transfer
      const resumePromise = transferManager.start(transfer.id);
      expect(transfer.status).toBe('active');

      await resumePromise;
      expect(transfer.status).toBe('completed');
    });

    it('should handle transfer cancellation', async () => {
      const file = new File(['test content'], 'test.txt');
      const transfer = transferManager.createTransfer(file, 'device-1');

      // Start transfer
      transferManager.start(transfer.id);

      // Cancel transfer
      transferManager.cancel(transfer.id);
      expect(transfer.status).toBe('failed');
      expect(transfer.error?.message).toBe('Transfer cancelled');
    });
  });

  describe('Chunked Transfer Flow', () => {
    it('should handle large file with chunks', async () => {
      // Create a large file (2MB)
      const size = 2 * 1024 * 1024;
      const content = new Uint8Array(size);
      const file = new File([content], 'large.bin');

      // Create chunk manager
      const chunkManager = new ChunkManager(file);

      expect(chunkManager.getTotalChunks()).toBeGreaterThan(1);
      expect(chunkManager.getProgress()).toBe(0);

      // Simulate uploading chunks
      const totalChunks = chunkManager.getTotalChunks();
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunkManager.getChunk(i);
        expect(chunk).not.toBeNull();
        
        // Mark as uploaded
        chunkManager.markChunkUploaded(i);
      }

      expect(chunkManager.isComplete()).toBe(true);
      expect(chunkManager.getProgress()).toBe(100);
    });

    it('should track progress during chunked transfer', async () => {
      const size = 3 * 1024 * 1024; // 3MB
      const content = new Uint8Array(size);
      const file = new File([content], 'large.bin');

      const chunkManager = new ChunkManager(file);
      const progressTracker = new ProgressTracker();

      progressTracker.start();

      const totalChunks = chunkManager.getTotalChunks();
      let uploadedBytes = 0;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunkManager.getChunk(i);
        if (chunk) {
          uploadedBytes += chunk.data.size;
          chunkManager.markChunkUploaded(i);

          // Update progress
          await new Promise(resolve => setTimeout(resolve, 10));
          const progress = progressTracker.update(uploadedBytes);

          expect(progress.averageSpeed).toBeGreaterThanOrEqual(0);
        }
      }

      expect(chunkManager.isComplete()).toBe(true);
      expect(progressTracker.getElapsedTime()).toBeGreaterThan(0);
    });
  });

  describe('Resume Transfer Flow', () => {
    it('should save and resume transfer state', async () => {
      const file = new File(['test content'], 'test.txt');
      const transfer = transferManager.createTransfer(file, 'device-1');

      // Save initial state
      await resumeManager.saveTransferState(
        transfer.id,
        transfer.fileName,
        transfer.fileSize,
        [0, 1, 2],
        10
      );

      // Load state
      const savedState = await resumeManager.loadTransferState(transfer.id);
      expect(savedState).toBeDefined();
      expect(savedState?.uploadedChunks).toEqual([0, 1, 2]);

      // Update progress
      await resumeManager.saveTransferState(
        transfer.id,
        transfer.fileName,
        transfer.fileSize,
        [0, 1, 2, 3, 4],
        10
      );

      // Load updated state
      const updatedState = await resumeManager.loadTransferState(transfer.id);
      expect(updatedState?.uploadedChunks).toEqual([0, 1, 2, 3, 4]);

      // Complete and cleanup
      await resumeManager.deleteTransferState(transfer.id);
      const deletedState = await resumeManager.loadTransferState(transfer.id);
      expect(deletedState).toBeUndefined();
    });

    it('should handle interrupted transfer resume', async () => {
      const size = 5 * 1024 * 1024; // 5MB
      const content = new Uint8Array(size);
      const file = new File([content], 'large.bin');

      const chunkManager = new ChunkManager(file);
      const totalChunks = chunkManager.getTotalChunks();

      // Simulate partial upload
      const uploadedChunks: number[] = [];
      for (let i = 0; i < Math.floor(totalChunks / 2); i++) {
        chunkManager.markChunkUploaded(i);
        uploadedChunks.push(i);
      }

      // Save state
      await resumeManager.saveTransferState(
        'transfer-1',
        file.name,
        file.size,
        uploadedChunks,
        totalChunks
      );

      // Simulate app restart - create new managers
      const newChunkManager = new ChunkManager(file);
      const savedState = await resumeManager.loadTransferState('transfer-1');

      expect(savedState).toBeDefined();
      expect(savedState?.uploadedChunks.length).toBe(Math.floor(totalChunks / 2));

      // Resume from saved state
      savedState?.uploadedChunks.forEach(index => {
        newChunkManager.markChunkUploaded(index);
      });

      // Continue upload
      const remainingChunks = newChunkManager.getRemainingChunks();
      expect(remainingChunks.length).toBe(totalChunks - uploadedChunks.length);

      // Complete upload
      remainingChunks.forEach(chunk => {
        newChunkManager.markChunkUploaded(chunk.index);
      });

      expect(newChunkManager.isComplete()).toBe(true);

      // Cleanup
      await resumeManager.deleteTransferState('transfer-1');
    });
  });

  describe('Multiple Transfers Flow', () => {
    it('should handle multiple concurrent transfers', async () => {
      const files = [
        new File(['content 1'], 'file1.txt'),
        new File(['content 2'], 'file2.txt'),
        new File(['content 3'], 'file3.txt')
      ];

      const transfers = files.map(file => 
        transferManager.createTransfer(file, 'device-1')
      );

      expect(transfers).toHaveLength(3);

      // Start all transfers
      const promises = transfers.map(transfer => 
        transferManager.start(transfer.id)
      );

      // Wait for all to complete
      await Promise.all(promises);

      // Verify all completed
      transfers.forEach(transfer => {
        expect(transfer.status).toBe('completed');
        expect(transfer.progress).toBe(100);
      });
    });

    it('should track multiple transfers independently', async () => {
      const transfer1 = transferManager.createTransfer(
        new File(['content 1'], 'file1.txt'),
        'device-1'
      );

      const transfer2 = transferManager.createTransfer(
        new File(['content 2'], 'file2.txt'),
        'device-2'
      );

      // Start first transfer
      transferManager.start(transfer1.id);
      expect(transfer1.status).toBe('active');
      expect(transfer2.status).toBe('pending');

      // Pause first, start second
      transferManager.pause(transfer1.id);
      transferManager.start(transfer2.id);

      expect(transfer1.status).toBe('paused');
      expect(transfer2.status).toBe('active');

      // Complete second
      await transferManager.start(transfer2.id);
      expect(transfer2.status).toBe('completed');

      // Resume and complete first
      await transferManager.start(transfer1.id);
      expect(transfer1.status).toBe('completed');
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle transfer errors gracefully', async () => {
      const file = new File(['test'], 'test.txt');
      const transfer = transferManager.createTransfer(file, 'device-1');

      // Cancel to simulate error
      transferManager.cancel(transfer.id);

      expect(transfer.status).toBe('failed');
      expect(transfer.error).toBeDefined();
    });

    it('should clean up failed transfers', async () => {
      const file = new File(['test'], 'test.txt');
      const transfer = transferManager.createTransfer(file, 'device-1');

      // Save state
      await resumeManager.saveTransferState(
        transfer.id,
        file.name,
        file.size,
        [],
        1
      );

      // Cancel transfer
      transferManager.cancel(transfer.id);

      // Cleanup
      await resumeManager.deleteTransferState(transfer.id);

      const state = await resumeManager.loadTransferState(transfer.id);
      expect(state).toBeUndefined();
    });
  });

  describe('Event Flow', () => {
    it('should emit events in correct order', async () => {
      const events: string[] = [];

      transferManager.on('transfer-created', () => events.push('created'));
      transferManager.on('transfer-started', () => events.push('started'));
      transferManager.on('transfer-completed', () => events.push('completed'));

      const file = new File(['test'], 'test.txt');
      const transfer = transferManager.createTransfer(file, 'device-1');

      await transferManager.start(transfer.id);

      expect(events).toEqual(['created', 'started', 'completed']);
    });

    it('should emit progress events', async () => {
      const progressEvents: number[] = [];

      transferManager.on('transfer-progress', (transfer) => {
        progressEvents.push(transfer.progress);
      });

      const file = new File(['test'], 'test.txt');
      const transfer = transferManager.createTransfer(file, 'device-1');

      await transferManager.start(transfer.id);

      // Should have received progress updates
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1]).toBe(100);
    });
  });
});
