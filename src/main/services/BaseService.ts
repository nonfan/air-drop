import { EventEmitter } from 'events';

/**
 * 服务基类
 * 提供统一的生命周期管理和错误处理
 */
export abstract class BaseService extends EventEmitter {
  protected isRunning = false;
  protected serviceName: string;

  constructor(serviceName: string) {
    super();
    this.serviceName = serviceName;
  }

  /**
   * 启动服务
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.log('warn', 'Service already running');
      return;
    }

    try {
      this.log('info', 'Starting service...');
      await this.onStart();
      this.isRunning = true;
      this.log('info', 'Service started successfully');
    } catch (error) {
      this.log('error', 'Failed to start service:', error);
      throw error;
    }
  }

  /**
   * 停止服务
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      this.log('info', 'Stopping service...');
      await this.onStop();
      this.isRunning = false;
      this.log('info', 'Service stopped');
    } catch (error) {
      this.log('error', 'Error stopping service:', error);
      throw error;
    }
  }

  /**
   * 检查服务是否运行中
   */
  getStatus(): boolean {
    return this.isRunning;
  }

  /**
   * 子类实现：启动逻辑
   */
  protected abstract onStart(): Promise<void>;

  /**
   * 子类实现：停止逻辑
   */
  protected abstract onStop(): Promise<void>;

  /**
   * 统一日志输出
   */
  protected log(level: 'info' | 'warn' | 'error', ...args: any[]): void {
    const prefix = `[${this.serviceName}]`;
    switch (level) {
      case 'info':
        console.log(prefix, ...args);
        break;
      case 'warn':
        console.warn(prefix, ...args);
        break;
      case 'error':
        console.error(prefix, ...args);
        break;
    }
  }

  /**
   * 安全的事件发射（带错误处理）
   */
  protected safeEmit(event: string, ...args: any[]): void {
    try {
      this.emit(event, ...args);
    } catch (error) {
      this.log('error', `Error emitting event "${event}":`, error);
    }
  }
}
