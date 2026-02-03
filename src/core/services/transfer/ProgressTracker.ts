/**
 * 进度追踪器 - 计算传输速度和剩余时间
 */
export class ProgressTracker {
  private startTime: number = 0;
  private lastUpdateTime: number = 0;
  private lastBytes: number = 0;
  private speeds: number[] = [];
  private readonly maxSpeedSamples = 10;

  start(): void {
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
    this.lastBytes = 0;
    this.speeds = [];
  }

  update(currentBytes: number): {
    speed: number;
    remainingTime: number;
    averageSpeed: number;
  } {
    const now = Date.now();
    const timeDiff = (now - this.lastUpdateTime) / 1000; // seconds
    const bytesDiff = currentBytes - this.lastBytes;

    if (timeDiff > 0) {
      const speed = bytesDiff / timeDiff; // bytes per second
      this.speeds.push(speed);

      if (this.speeds.length > this.maxSpeedSamples) {
        this.speeds.shift();
      }

      this.lastUpdateTime = now;
      this.lastBytes = currentBytes;
    }

    const averageSpeed = this.getAverageSpeed();
    const remainingTime = this.calculateRemainingTime(currentBytes, averageSpeed);

    return {
      speed: this.speeds[this.speeds.length - 1] || 0,
      remainingTime,
      averageSpeed
    };
  }

  private getAverageSpeed(): number {
    if (this.speeds.length === 0) return 0;
    const sum = this.speeds.reduce((a, b) => a + b, 0);
    return sum / this.speeds.length;
  }

  private calculateRemainingTime(currentBytes: number, speed: number): number {
    if (speed === 0) return 0;
    // This would need total size to calculate properly
    // For now, return 0 as placeholder
    return 0;
  }

  getElapsedTime(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  reset(): void {
    this.startTime = 0;
    this.lastUpdateTime = 0;
    this.lastBytes = 0;
    this.speeds = [];
  }
}
