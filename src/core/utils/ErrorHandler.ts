import { AppError } from '../types/common';

type ErrorHandlerFn = (error: AppError) => void;

/**
 * 统一错误处理器
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorHandlers: Map<string, ErrorHandlerFn> = new Map();
  private defaultHandler: ErrorHandlerFn;

  private constructor() {
    this.defaultHandler = this.createDefaultHandler();
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  register(type: string, handler: ErrorHandlerFn): void {
    this.errorHandlers.set(type, handler);
  }

  handle(error: AppError): void {
    const handler = this.errorHandlers.get(error.type);
    if (handler) {
      handler(error);
    } else {
      this.defaultHandler(error);
    }
  }

  private createDefaultHandler(): ErrorHandlerFn {
    return (error: AppError) => {
      console.error('[ErrorHandler]', error);
      
      // Show user-friendly notification
      if (typeof window !== 'undefined') {
        const message = this.getUserFriendlyMessage(error);
        // This would integrate with your notification system
        console.log('[Notification]', message);
      }
    };
  }

  private getUserFriendlyMessage(error: AppError): string {
    switch (error.type) {
      case 'network':
        return '网络连接失败，请检查网络设置';
      case 'transfer':
        return '文件传输失败，请重试';
      case 'storage':
        return '存储空间不足或无法访问';
      default:
        return error.message || '发生未知错误';
    }
  }
}

/**
 * 便捷函数
 */
export function handleError(error: AppError): void {
  ErrorHandler.getInstance().handle(error);
}

export function registerErrorHandler(type: string, handler: ErrorHandlerFn): void {
  ErrorHandler.getInstance().register(type, handler);
}
