/**
 * ErrorHandler 单元测试
 */
import { ErrorHandler, handleError, registerErrorHandler } from '../utils/ErrorHandler';
import { AppError } from '../types/common';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    errorHandler = ErrorHandler.getInstance();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('handle', () => {
    it('should handle network errors', () => {
      const error: AppError = {
        type: 'network',
        message: 'Connection failed'
      };

      errorHandler.handle(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ErrorHandler]', error);
    });

    it('should handle transfer errors', () => {
      const error: AppError = {
        type: 'transfer',
        message: 'Transfer failed'
      };

      errorHandler.handle(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ErrorHandler]', error);
    });

    it('should handle storage errors', () => {
      const error: AppError = {
        type: 'storage',
        message: 'Storage full'
      };

      errorHandler.handle(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ErrorHandler]', error);
    });

    it('should handle unknown errors', () => {
      const error: AppError = {
        type: 'unknown',
        message: 'Something went wrong'
      };

      errorHandler.handle(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ErrorHandler]', error);
    });

    it('should include error code if provided', () => {
      const error: AppError = {
        type: 'network',
        message: 'Connection failed',
        code: 'ECONNREFUSED'
      };

      errorHandler.handle(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ErrorHandler]', error);
    });

    it('should include error details if provided', () => {
      const error: AppError = {
        type: 'transfer',
        message: 'Transfer failed',
        details: { fileName: 'test.txt', size: 1024 }
      };

      errorHandler.handle(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ErrorHandler]', error);
    });
  });

  describe('register', () => {
    it('should register custom error handler', () => {
      const customHandler = jest.fn();
      const error: AppError = {
        type: 'network',
        message: 'Custom error'
      };

      errorHandler.register('network', customHandler);
      errorHandler.handle(error);

      expect(customHandler).toHaveBeenCalledWith(error);
    });

    it('should override default handler for registered type', () => {
      const customHandler = jest.fn();
      const error: AppError = {
        type: 'transfer',
        message: 'Custom error'
      };

      errorHandler.register('transfer', customHandler);
      errorHandler.handle(error);

      expect(customHandler).toHaveBeenCalledWith(error);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should allow multiple handlers for different types', () => {
      const networkHandler = jest.fn();
      const transferHandler = jest.fn();

      errorHandler.register('network', networkHandler);
      errorHandler.register('transfer', transferHandler);

      const networkError: AppError = {
        type: 'network',
        message: 'Network error'
      };

      const transferError: AppError = {
        type: 'transfer',
        message: 'Transfer error'
      };

      errorHandler.handle(networkError);
      errorHandler.handle(transferError);

      expect(networkHandler).toHaveBeenCalledWith(networkError);
      expect(transferHandler).toHaveBeenCalledWith(transferError);
    });
  });

  describe('user-friendly messages', () => {
    it('should show user-friendly message for network errors', () => {
      const error: AppError = {
        type: 'network',
        message: 'ECONNREFUSED'
      };

      errorHandler.handle(error);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Notification]',
        '网络连接失败，请检查网络设置'
      );
    });

    it('should show user-friendly message for transfer errors', () => {
      const error: AppError = {
        type: 'transfer',
        message: 'Chunk upload failed'
      };

      errorHandler.handle(error);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Notification]',
        '文件传输失败，请重试'
      );
    });

    it('should show user-friendly message for storage errors', () => {
      const error: AppError = {
        type: 'storage',
        message: 'ENOSPC'
      };

      errorHandler.handle(error);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Notification]',
        '存储空间不足或无法访问'
      );
    });

    it('should show generic message for unknown errors', () => {
      const error: AppError = {
        type: 'unknown',
        message: 'Unexpected error'
      };

      errorHandler.handle(error);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[Notification]',
        'Unexpected error'
      );
    });
  });

  describe('convenience functions', () => {
    it('handleError should work', () => {
      const error: AppError = {
        type: 'network',
        message: 'Test error'
      };

      handleError(error);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ErrorHandler]', error);
    });

    it('registerErrorHandler should work', () => {
      const customHandler = jest.fn();
      const error: AppError = {
        type: 'storage',
        message: 'Test error'
      };

      registerErrorHandler('storage', customHandler);
      handleError(error);

      expect(customHandler).toHaveBeenCalledWith(error);
    });
  });

  describe('edge cases', () => {
    it('should handle error without message', () => {
      const error: AppError = {
        type: 'unknown',
        message: ''
      };

      expect(() => errorHandler.handle(error)).not.toThrow();
    });

    it('should handle error with very long message', () => {
      const error: AppError = {
        type: 'network',
        message: 'A'.repeat(10000)
      };

      expect(() => errorHandler.handle(error)).not.toThrow();
    });

    it('should handle error with complex details', () => {
      const error: AppError = {
        type: 'transfer',
        message: 'Complex error',
        details: {
          nested: {
            deeply: {
              value: 'test'
            }
          },
          array: [1, 2, 3]
        }
      };

      expect(() => errorHandler.handle(error)).not.toThrow();
    });
  });

  describe('multiple error handling', () => {
    it('should handle multiple errors in sequence', () => {
      const errors: AppError[] = [
        { type: 'network', message: 'Error 1' },
        { type: 'transfer', message: 'Error 2' },
        { type: 'storage', message: 'Error 3' }
      ];

      errors.forEach(error => errorHandler.handle(error));

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle same error multiple times', () => {
      const error: AppError = {
        type: 'network',
        message: 'Repeated error'
      };

      errorHandler.handle(error);
      errorHandler.handle(error);
      errorHandler.handle(error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    });
  });
});
