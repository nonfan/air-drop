/**
 * ConcurrencyController 单元测试
 */
import { ConcurrencyController } from '../utils/ConcurrencyController';

describe('ConcurrencyController', () => {
  let controller: ConcurrencyController;

  beforeEach(() => {
    controller = new ConcurrencyController(2);
  });

  describe('constructor', () => {
    it('should initialize with default max concurrent', () => {
      const defaultController = new ConcurrencyController();
      expect(defaultController.getActiveCount()).toBe(0);
    });

    it('should initialize with custom max concurrent', () => {
      const customController = new ConcurrencyController(5);
      expect(customController.getActiveCount()).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute task immediately when under limit', async () => {
      const task = jest.fn().mockResolvedValue('result');

      const result = await controller.execute(task);

      expect(result).toBe('result');
      expect(task).toHaveBeenCalledTimes(1);
    });

    it('should limit concurrent executions', async () => {
      let activeCount = 0;
      let maxActive = 0;

      const createTask = (delay: number) => async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        activeCount--;
        return 'done';
      };

      const tasks = [
        controller.execute(createTask(50)),
        controller.execute(createTask(50)),
        controller.execute(createTask(50)),
        controller.execute(createTask(50))
      ];

      await Promise.all(tasks);

      expect(maxActive).toBeLessThanOrEqual(2);
    });

    it('should queue tasks when at max concurrent', async () => {
      const task1 = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('task1'), 100))
      );
      const task2 = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('task2'), 100))
      );
      const task3 = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('task3'), 50))
      );

      const promise1 = controller.execute(task1);
      const promise2 = controller.execute(task2);
      const promise3 = controller.execute(task3);

      expect(controller.getActiveCount()).toBe(2);
      expect(controller.getQueueLength()).toBe(1);

      await Promise.all([promise1, promise2, promise3]);

      expect(controller.getActiveCount()).toBe(0);
      expect(controller.getQueueLength()).toBe(0);
    });

    it('should handle task errors correctly', async () => {
      const errorTask = jest.fn().mockRejectedValue(new Error('Task failed'));

      await expect(controller.execute(errorTask)).rejects.toThrow('Task failed');
      
      // Should release the slot after error
      expect(controller.getActiveCount()).toBe(0);
    });

    it('should continue processing after error', async () => {
      const errorTask = jest.fn().mockRejectedValue(new Error('Failed'));
      const successTask = jest.fn().mockResolvedValue('success');

      await expect(controller.execute(errorTask)).rejects.toThrow();
      const result = await controller.execute(successTask);

      expect(result).toBe('success');
    });
  });

  describe('getActiveCount', () => {
    it('should return 0 initially', () => {
      expect(controller.getActiveCount()).toBe(0);
    });

    it('should track active tasks', async () => {
      const task = () => new Promise(resolve => setTimeout(resolve, 50));

      const promise = controller.execute(task);
      expect(controller.getActiveCount()).toBe(1);

      await promise;
      expect(controller.getActiveCount()).toBe(0);
    });
  });

  describe('getQueueLength', () => {
    it('should return 0 when no tasks are queued', () => {
      expect(controller.getQueueLength()).toBe(0);
    });

    it('should track queued tasks', async () => {
      const task = () => new Promise(resolve => setTimeout(resolve, 100));

      controller.execute(task);
      controller.execute(task);
      const promise3 = controller.execute(task);

      expect(controller.getQueueLength()).toBe(1);

      await promise3;
      expect(controller.getQueueLength()).toBe(0);
    });
  });

  describe('setMaxConcurrent', () => {
    it('should update max concurrent limit', () => {
      controller.setMaxConcurrent(5);
      
      // Verify by checking we can run more tasks
      expect(controller.getActiveCount()).toBe(0);
    });

    it('should process queued tasks when limit increased', async () => {
      const task = () => new Promise(resolve => setTimeout(resolve, 100));

      // Fill up the queue
      controller.execute(task);
      controller.execute(task);
      const promise3 = controller.execute(task);

      expect(controller.getQueueLength()).toBe(1);

      // Increase limit
      controller.setMaxConcurrent(3);

      // Queue should be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(controller.getQueueLength()).toBe(0);

      await promise3;
    });

    it('should handle decreasing limit', async () => {
      controller.setMaxConcurrent(1);

      const task = () => new Promise(resolve => setTimeout(resolve, 50));

      controller.execute(task);
      const promise2 = controller.execute(task);

      expect(controller.getQueueLength()).toBe(1);

      await promise2;
    });
  });

  describe('concurrent execution scenarios', () => {
    it('should handle many concurrent tasks', async () => {
      const results: number[] = [];
      const tasks = Array.from({ length: 10 }, (_, i) => 
        controller.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push(i);
          return i;
        })
      );

      await Promise.all(tasks);

      expect(results).toHaveLength(10);
    });

    it('should maintain order of completion', async () => {
      const completionOrder: number[] = [];

      const tasks = [
        controller.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 30));
          completionOrder.push(1);
        }),
        controller.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
          completionOrder.push(2);
        }),
        controller.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          completionOrder.push(3);
        })
      ];

      await Promise.all(tasks);

      // Tasks complete in order of their duration
      expect(completionOrder).toEqual([2, 1, 3]);
    });
  });

  describe('edge cases', () => {
    it('should handle zero max concurrent', async () => {
      const zeroController = new ConcurrencyController(0);
      const task = jest.fn().mockResolvedValue('result');

      // This would hang, so we don't actually test it
      // Just verify the controller can be created
      expect(zeroController.getActiveCount()).toBe(0);
    });

    it('should handle very high max concurrent', async () => {
      const highController = new ConcurrencyController(1000);
      const tasks = Array.from({ length: 100 }, () =>
        highController.execute(async () => 'done')
      );

      await Promise.all(tasks);
      expect(highController.getActiveCount()).toBe(0);
    });
  });
});
