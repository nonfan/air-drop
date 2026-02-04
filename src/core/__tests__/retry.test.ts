/**
 * Retry utilities 单元测试
 */
import { retry, retryWithBackoff, sleep, withTimeout } from '../utils/retry';

describe('retry utilities', () => {
  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('retry', () => {
    it('should succeed on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retry(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const result = await retry(fn, 3, 10);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('always fails'));

      await expect(retry(fn, 2, 10)).rejects.toThrow('always fails');
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should use fixed delay', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const start = Date.now();
      await retry(fn, 3, 50);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(40);
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first try', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await retryWithBackoff(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const start = Date.now();
      await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 10,
        backoffMultiplier: 2
      });
      const elapsed = Date.now() - start;

      // Should have delays of 10ms and 20ms
      expect(elapsed).toBeGreaterThanOrEqual(25);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect max delay', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const start = Date.now();
      await retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelay: 1000,
        maxDelay: 50,
        backoffMultiplier: 10
      });
      const elapsed = Date.now() - start;

      // Should cap at maxDelay (50ms) instead of 1000ms
      expect(elapsed).toBeLessThan(150);
    });

    it('should call onRetry callback', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success');

      const onRetry = jest.fn();

      await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 10,
        onRetry
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error));
    });

    it('should throw after max retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('always fails'));

      await expect(
        retryWithBackoff(fn, { maxRetries: 2, baseDelay: 10 })
      ).rejects.toThrow('always fails');

      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should handle zero retries', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(
        retryWithBackoff(fn, { maxRetries: 0 })
      ).rejects.toThrow('fail');

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes in time', async () => {
      const promise = new Promise(resolve => 
        setTimeout(() => resolve('success'), 50)
      );

      const result = await withTimeout(promise, 200);

      expect(result).toBe('success');
    });

    it('should reject if promise times out', async () => {
      const promise = new Promise(resolve => 
        setTimeout(() => resolve('success'), 200)
      );

      await expect(withTimeout(promise, 50)).rejects.toThrow('Operation timed out');
    });

    it('should use custom timeout error', async () => {
      const promise = new Promise(resolve => 
        setTimeout(() => resolve('success'), 200)
      );

      const customError = new Error('Custom timeout');

      await expect(
        withTimeout(promise, 50, customError)
      ).rejects.toThrow('Custom timeout');
    });

    it('should handle promise rejection', async () => {
      const promise = Promise.reject(new Error('Promise failed'));

      await expect(withTimeout(promise, 100)).rejects.toThrow('Promise failed');
    });

    it('should handle immediate resolution', async () => {
      const promise = Promise.resolve('immediate');

      const result = await withTimeout(promise, 100);

      expect(result).toBe('immediate');
    });
  });

  describe('integration scenarios', () => {
    it('should combine retry with timeout', async () => {
      let attempts = 0;
      const fn = async () => {
        attempts++;
        if (attempts < 3) {
          await sleep(200); // Will timeout
          return 'success';
        }
        return 'success';
      };

      const result = await retry(
        () => withTimeout(fn(), 50),
        3,
        10
      );

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should handle complex retry scenarios', async () => {
      const errors: Error[] = [];
      let attempts = 0;

      const fn = async () => {
        attempts++;
        if (attempts === 1) throw new Error('Network error');
        if (attempts === 2) throw new Error('Timeout');
        return 'success';
      };

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelay: 10,
        onRetry: (attempt, error) => {
          errors.push(error);
        }
      });

      expect(result).toBe('success');
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe('Network error');
      expect(errors[1].message).toBe('Timeout');
    });
  });
});
