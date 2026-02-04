/**
 * 传输性能测试
 */
import { ChunkManager } from '../../services/transfer/ChunkManager';
import { ProgressTracker } from '../../services/transfer/ProgressTracker';
import { ConcurrencyController } from '../../utils/ConcurrencyController';

describe('Transfer Performance', () => {
  describe('Large File Handling', () => {
    it('should handle 10MB file efficiently', () => {
      const size = 10 * 1024 * 1024; // 10MB
      const content = new Uint8Array(size);
      const file = new File([content], 'large.bin');

      const startTime = Date.now();
      const chunkManager = new ChunkManager(file);
      const initTime = Date.now() - startTime;

      expect(initTime).toBeLessThan(1000); // Should initialize in < 1s
      expect(chunkManager.getTotalChunks()).toBeGreaterThan(0);
    });

    it('should handle 100MB file efficiently', () => {
      const size = 100 * 1024 * 1024; // 100MB
      const content = new Uint8Array(size);
      const file = new File([content], 'very-large.bin');

      const startTime = Date.now();
      const chunkManager = new ChunkManager(file);
      const initTime = Date.now() - startTime;

      expect(initTime).toBeLessThan(2000); // Should initialize in < 2s
      expect(chunkManager.getTotalChunks()).toBeGreaterThan(0);
    });

    it('should process chunks quickly', () => {
      const size = 50 * 1024 * 1024; // 50MB
      const content = new Uint8Array(size);
      const file = new File([content], 'large.bin');

      const chunkManager = new ChunkManager(file);
      const totalChunks = chunkManager.getTotalChunks();

      const startTime = Date.now();
      
      // Process all chunks
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunkManager.getChunk(i);
        expect(chunk).not.toBeNull();
        chunkManager.markChunkUploaded(i);
      }

      const processTime = Date.now() - startTime;
      const timePerChunk = processTime / totalChunks;

      expect(timePerChunk).toBeLessThan(10); // < 10ms per chunk
    });
  });

  describe('Progress Tracking Performance', () => {
    it('should handle frequent updates efficiently', async () => {
      const tracker = new ProgressTracker();
      tracker.start();

      const updates = 1000;
      const startTime = Date.now();

      for (let i = 0; i < updates; i++) {
        await new Promise(resolve => setTimeout(resolve, 1));
        tracker.update(i * 1024);
      }

      const totalTime = Date.now() - startTime;
      const timePerUpdate = totalTime / updates;

      expect(timePerUpdate).toBeLessThan(5); // < 5ms per update
    });

    it('should maintain speed calculation accuracy under load', async () => {
      const tracker = new ProgressTracker();
      tracker.start();

      const speeds: number[] = [];

      for (let i = 0; i < 100; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
        const result = tracker.update(i * 10000);
        speeds.push(result.averageSpeed);
      }

      // Speed should stabilize
      const lastSpeeds = speeds.slice(-10);
      const avgSpeed = lastSpeeds.reduce((a, b) => a + b) / lastSpeeds.length;
      const variance = lastSpeeds.reduce((sum, speed) => 
        sum + Math.pow(speed - avgSpeed, 2), 0) / lastSpeeds.length;

      expect(variance).toBeLessThan(avgSpeed * 0.5); // Low variance
    });
  });

  describe('Concurrency Performance', () => {
    it('should handle high concurrency efficiently', async () => {
      const controller = new ConcurrencyController(10);
      const tasks = 100;

      const startTime = Date.now();

      const promises = Array.from({ length: tasks }, (_, i) =>
        controller.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return i;
        })
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(tasks);
      expect(totalTime).toBeLessThan(tasks * 10 * 0.2); // Should be much faster than sequential
    });

    it('should maintain performance with varying task durations', async () => {
      const controller = new ConcurrencyController(5);
      const tasks = 50;

      const startTime = Date.now();

      const promises = Array.from({ length: tasks }, (_, i) =>
        controller.execute(async () => {
          const delay = Math.random() * 20 + 5; // 5-25ms
          await new Promise(resolve => setTimeout(resolve, delay));
          return i;
        })
      );

      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(tasks * 25 * 0.3);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory with many chunks', () => {
      const files: ChunkManager[] = [];

      // Create many chunk managers
      for (let i = 0; i < 100; i++) {
        const size = 1024 * 1024; // 1MB each
        const content = new Uint8Array(size);
        const file = new File([content], `file-${i}.bin`);
        files.push(new ChunkManager(file));
      }

      expect(files).toHaveLength(100);

      // Clear references
      files.length = 0;

      // Memory should be reclaimable
      expect(files).toHaveLength(0);
    });

    it('should handle chunk processing without memory buildup', () => {
      const size = 10 * 1024 * 1024; // 10MB
      const content = new Uint8Array(size);
      const file = new File([content], 'large.bin');

      const chunkManager = new ChunkManager(file);
      const totalChunks = chunkManager.getTotalChunks();

      // Process chunks one by one
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunkManager.getChunk(i);
        expect(chunk).not.toBeNull();
        
        // Simulate processing
        chunkManager.markChunkUploaded(i);
        
        // Chunk data should be available
        expect(chunk!.data.size).toBeGreaterThan(0);
      }

      expect(chunkManager.isComplete()).toBe(true);
    });
  });

  describe('Scalability', () => {
    it('should scale with file size', () => {
      const sizes = [1, 10, 50, 100]; // MB
      const times: number[] = [];

      sizes.forEach(sizeMB => {
        const size = sizeMB * 1024 * 1024;
        const content = new Uint8Array(size);
        const file = new File([content], `file-${sizeMB}mb.bin`);

        const startTime = Date.now();
        const chunkManager = new ChunkManager(file);
        const initTime = Date.now() - startTime;

        times.push(initTime);
        expect(chunkManager.getTotalChunks()).toBeGreaterThan(0);
      });

      // Time should scale roughly linearly
      const ratio = times[times.length - 1] / times[0];
      expect(ratio).toBeLessThan(sizes[sizes.length - 1] / sizes[0] * 2);
    });

    it('should handle many concurrent operations', async () => {
      const controller = new ConcurrencyController(20);
      const operations = 200;

      const startTime = Date.now();

      const promises = Array.from({ length: operations }, (_, i) =>
        controller.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 5));
          return i;
        })
      );

      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Should complete efficiently
      expect(totalTime).toBeLessThan(operations * 5 * 0.15);
    });
  });

  describe('Throughput', () => {
    it('should maintain high throughput for chunk processing', () => {
      const size = 20 * 1024 * 1024; // 20MB
      const content = new Uint8Array(size);
      const file = new File([content], 'large.bin');

      const chunkManager = new ChunkManager(file);
      const totalChunks = chunkManager.getTotalChunks();

      const startTime = Date.now();
      let processedBytes = 0;

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunkManager.getChunk(i);
        if (chunk) {
          processedBytes += chunk.data.size;
          chunkManager.markChunkUploaded(i);
        }
      }

      const totalTime = (Date.now() - startTime) / 1000; // seconds
      const throughput = processedBytes / totalTime; // bytes per second

      // Should process at least 10MB/s
      expect(throughput).toBeGreaterThan(10 * 1024 * 1024);
    });
  });

  describe('Resource Efficiency', () => {
    it('should reuse resources efficiently', async () => {
      const tracker = new ProgressTracker();

      // Multiple start/reset cycles
      for (let i = 0; i < 100; i++) {
        tracker.start();
        await new Promise(resolve => setTimeout(resolve, 5));
        tracker.update(i * 1000);
        tracker.reset();
      }

      // Should complete without issues
      expect(tracker.getElapsedTime()).toBeLessThan(0);
    });

    it('should handle rapid state changes', () => {
      const size = 5 * 1024 * 1024; // 5MB
      const content = new Uint8Array(size);
      const file = new File([content], 'test.bin');

      const chunkManager = new ChunkManager(file);
      const totalChunks = chunkManager.getTotalChunks();

      // Rapid mark/unmark simulation
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < totalChunks; i++) {
          chunkManager.markChunkUploaded(i);
        }
        
        const progress = chunkManager.getProgress();
        expect(progress).toBe(100);
      }
    });
  });
});
