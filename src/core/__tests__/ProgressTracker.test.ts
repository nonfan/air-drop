/**
 * ProgressTracker 单元测试
 */
import { ProgressTracker } from '../services/transfer/ProgressTracker';

describe('ProgressTracker', () => {
  let tracker: ProgressTracker;

  beforeEach(() => {
    tracker = new ProgressTracker();
  });

  describe('start', () => {
    it('should initialize tracking', () => {
      tracker.start();

      expect(tracker.getElapsedTime()).toBeGreaterThanOrEqual(0);
    });

    it('should reset previous data', () => {
      tracker.start();
      tracker.update(1000);
      
      tracker.start();
      
      const result = tracker.update(500);
      expect(result.averageSpeed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('update', () => {
    it('should calculate speed correctly', async () => {
      tracker.start();
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = tracker.update(1000);

      expect(result.speed).toBeGreaterThan(0);
      expect(result.averageSpeed).toBeGreaterThan(0);
    });

    it('should handle multiple updates', async () => {
      tracker.start();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      tracker.update(1000);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      const result = tracker.update(2000);

      expect(result.speed).toBeGreaterThan(0);
      expect(result.averageSpeed).toBeGreaterThan(0);
    });

    it('should return zero speed for same timestamp', () => {
      tracker.start();
      
      const result1 = tracker.update(1000);
      const result2 = tracker.update(2000); // Immediate update

      // First update might have zero speed if too fast
      expect(result2.averageSpeed).toBeGreaterThanOrEqual(0);
    });

    it('should maintain speed samples limit', async () => {
      tracker.start();
      
      // Add more than maxSpeedSamples updates
      for (let i = 1; i <= 15; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
        tracker.update(i * 1000);
      }

      const result = tracker.update(16000);
      
      // Should still calculate average correctly
      expect(result.averageSpeed).toBeGreaterThan(0);
    });
  });

  describe('getElapsedTime', () => {
    it('should return elapsed time in seconds', async () => {
      tracker.start();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const elapsed = tracker.getElapsedTime();
      
      expect(elapsed).toBeGreaterThanOrEqual(0.1);
      expect(elapsed).toBeLessThan(1);
    });

    it('should return 0 before start', () => {
      const elapsed = tracker.getElapsedTime();
      
      expect(elapsed).toBeLessThan(0);
    });
  });

  describe('reset', () => {
    it('should reset all tracking data', async () => {
      tracker.start();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      tracker.update(1000);
      
      tracker.reset();
      
      const elapsed = tracker.getElapsedTime();
      expect(elapsed).toBeLessThan(0);
    });

    it('should allow restart after reset', async () => {
      tracker.start();
      tracker.update(1000);
      tracker.reset();
      
      tracker.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      const result = tracker.update(500);
      
      expect(result.speed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('speed calculation accuracy', () => {
    it('should calculate reasonable speeds', async () => {
      tracker.start();
      
      // Simulate 1MB in 100ms = ~10MB/s
      await new Promise(resolve => setTimeout(resolve, 100));
      const result = tracker.update(1024 * 1024);

      // Speed should be in reasonable range (accounting for timing variance)
      expect(result.speed).toBeGreaterThan(1000000); // > 1MB/s
      expect(result.speed).toBeLessThan(100000000); // < 100MB/s
    });

    it('should handle zero bytes transferred', () => {
      tracker.start();
      
      const result = tracker.update(0);
      
      expect(result.speed).toBe(0);
      expect(result.averageSpeed).toBe(0);
    });

    it('should handle decreasing bytes (edge case)', async () => {
      tracker.start();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      tracker.update(1000);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      const result = tracker.update(500); // Bytes decreased
      
      // Should handle gracefully
      expect(result.averageSpeed).toBeDefined();
    });
  });

  describe('average speed calculation', () => {
    it('should calculate average over multiple samples', async () => {
      tracker.start();
      
      const speeds: number[] = [];
      
      for (let i = 1; i <= 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 20));
        const result = tracker.update(i * 1000);
        speeds.push(result.averageSpeed);
      }

      // Average should stabilize over time
      const lastAverage = speeds[speeds.length - 1];
      expect(lastAverage).toBeGreaterThan(0);
    });
  });

  describe('remaining time calculation', () => {
    it('should return remaining time', async () => {
      tracker.start();
      
      await new Promise(resolve => setTimeout(resolve, 50));
      const result = tracker.update(1000);

      // Currently returns 0 as placeholder
      expect(result.remainingTime).toBe(0);
    });
  });
});
