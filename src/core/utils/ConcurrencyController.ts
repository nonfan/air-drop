/**
 * 并发控制器 - 限制同时执行的任务数量
 */
export class ConcurrencyController {
  private maxConcurrent: number;
  private activeCount: number = 0;
  private queue: Array<() => Promise<any>> = [];
  private waiters: Array<() => void> = [];

  constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    while (this.activeCount >= this.maxConcurrent) {
      await this.waitForSlot();
    }

    this.activeCount++;
    
    try {
      return await task();
    } finally {
      this.activeCount--;
      this.notifyWaiters();
    }
  }

  private waitForSlot(): Promise<void> {
    return new Promise(resolve => {
      this.waiters.push(resolve);
    });
  }

  private notifyWaiters(): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter();
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  getQueueLength(): number {
    return this.waiters.length;
  }

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    // Notify waiters if we increased the limit
    while (this.activeCount < this.maxConcurrent && this.waiters.length > 0) {
      this.notifyWaiters();
    }
  }
}
