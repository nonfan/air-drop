/**
 * UnifiedTransportService 单元测试
 */
import { UnifiedTransportService } from '../services/transport/UnifiedTransport';

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const mockSocket = {
    connected: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn()
  };

  return {
    io: jest.fn(() => mockSocket),
    __mockSocket: mockSocket
  };
});

describe('UnifiedTransportService', () => {
  let service: UnifiedTransportService;
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    const socketIo = require('socket.io-client');
    mockSocket = socketIo.__mockSocket;
    mockSocket.connected = false;

    service = new UnifiedTransportService({
      url: 'http://localhost:3000'
    });
  });

  afterEach(() => {
    service.removeAllListeners();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const defaultService = new UnifiedTransportService({
        url: 'http://localhost:3000'
      });

      expect(defaultService).toBeDefined();
    });

    it('should accept custom config', () => {
      const customService = new UnifiedTransportService({
        url: 'http://localhost:3000',
        reconnection: false,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000
      });

      expect(customService).toBeDefined();
    });
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      // Simulate successful connection
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });

      const connectPromise = service.connect();
      mockSocket.connected = true;

      await connectPromise;

      expect(mockSocket.connected).toBe(true);
    });

    it('should emit connected event', async () => {
      const connectedSpy = jest.fn();
      service.on('connected', connectedSpy);

      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });

      const connectPromise = service.connect();
      mockSocket.connected = true;

      await connectPromise;

      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should not connect if already connected', async () => {
      mockSocket.connected = true;

      await service.connect();

      // Should return immediately without creating new socket
      expect(mockSocket.once).not.toHaveBeenCalled();
    });

    it('should throw error if connection already in progress', async () => {
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        // Never resolve to simulate in-progress connection
      });

      const firstConnect = service.connect();

      await expect(service.connect()).rejects.toThrow('Connection already in progress');

      // Clean up
      mockSocket.connected = true;
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') callback();
      });
    });

    it('should handle connection timeout', async () => {
      mockSocket.once.mockImplementation(() => {
        // Never call callback to simulate timeout
      });

      await expect(service.connect()).rejects.toThrow('Connection timeout');
    });

    it('should handle connection error', async () => {
      const error = new Error('Connection failed');

      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect_error') {
          setTimeout(() => callback(error), 0);
        }
      });

      await expect(service.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      mockSocket.connected = true;
      await service.connect();
    });

    it('should disconnect successfully', () => {
      service.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('should emit disconnected event', () => {
      const disconnectedSpy = jest.fn();
      service.on('disconnected', disconnectedSpy);

      service.disconnect();

      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should handle disconnect when not connected', () => {
      service.disconnect();
      service.disconnect(); // Second call

      expect(() => service.disconnect()).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should return true when connected', async () => {
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      mockSocket.connected = true;

      await service.connect();

      expect(service.isConnected()).toBe(true);
    });

    it('should return false after disconnect', async () => {
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      mockSocket.connected = true;

      await service.connect();
      
      mockSocket.connected = false;
      service.disconnect();

      expect(service.isConnected()).toBe(false);
    });
  });

  describe('send', () => {
    beforeEach(async () => {
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      mockSocket.connected = true;
      await service.connect();
    });

    it('should send event with data', () => {
      const data = { message: 'test' };

      service.send('test-event', data);

      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', data);
    });

    it('should send event without data', () => {
      service.send('test-event');

      expect(mockSocket.emit).toHaveBeenCalledWith('test-event', undefined);
    });

    it('should throw error when not connected', () => {
      mockSocket.connected = false;

      expect(() => service.send('test-event')).toThrow('Not connected');
    });
  });

  describe('event handlers', () => {
    beforeEach(async () => {
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      mockSocket.connected = true;
      await service.connect();
    });

    it('should register event handler', () => {
      const handler = jest.fn();

      service.on('custom-event', handler);

      expect(mockSocket.on).toHaveBeenCalledWith('custom-event', handler);
    });

    it('should remove event handler', () => {
      const handler = jest.fn();

      service.on('custom-event', handler);
      service.off('custom-event', handler);

      expect(mockSocket.off).toHaveBeenCalledWith('custom-event', handler);
    });

    it('should remove all handlers for event', () => {
      service.off('custom-event');

      expect(mockSocket.off).toHaveBeenCalledWith('custom-event', undefined);
    });

    it('should throw error when registering handler without socket', () => {
      const uninitializedService = new UnifiedTransportService({
        url: 'http://localhost:3000'
      });

      expect(() => uninitializedService.on('event', jest.fn())).toThrow('Socket not initialized');
    });
  });

  describe('automatic event handlers', () => {
    it('should handle disconnect event', async () => {
      const disconnectedSpy = jest.fn();
      
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      mockSocket.connected = true;

      await service.connect();
      
      service.on('disconnected', disconnectedSpy);

      // Simulate disconnect event
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )?.[1];
      
      if (disconnectHandler) {
        disconnectHandler('transport close');
      }

      expect(disconnectedSpy).toHaveBeenCalledWith('transport close');
    });

    it('should handle reconnect event', async () => {
      const reconnectedSpy = jest.fn();
      
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      mockSocket.connected = true;

      await service.connect();
      
      service.on('reconnected', reconnectedSpy);

      // Simulate reconnect event
      const reconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'reconnect'
      )?.[1];
      
      if (reconnectHandler) {
        reconnectHandler(3);
      }

      expect(reconnectedSpy).toHaveBeenCalledWith(3);
    });

    it('should handle reconnect_error event', async () => {
      const errorSpy = jest.fn();
      
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      mockSocket.connected = true;

      await service.connect();
      
      service.on('reconnect_error', errorSpy);

      // Simulate reconnect_error event
      const errorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'reconnect_error'
      )?.[1];
      
      const error = new Error('Reconnect failed');
      if (errorHandler) {
        errorHandler(error);
      }

      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it('should handle error event', async () => {
      const errorSpy = jest.fn();
      
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      mockSocket.connected = true;

      await service.connect();
      
      service.on('error', errorSpy);

      // Simulate error event
      const errorHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];
      
      const error = new Error('Socket error');
      if (errorHandler) {
        errorHandler(error);
      }

      expect(errorSpy).toHaveBeenCalledWith(error);
    });
  });

  describe('connection lifecycle', () => {
    it('should support full connection lifecycle', async () => {
      const connectedSpy = jest.fn();
      const disconnectedSpy = jest.fn();

      service.on('connected', connectedSpy);
      service.on('disconnected', disconnectedSpy);

      // Connect
      mockSocket.once.mockImplementation((event: string, callback: Function) => {
        if (event === 'connect') {
          setTimeout(() => callback(), 0);
        }
      });
      mockSocket.connected = true;

      await service.connect();
      expect(connectedSpy).toHaveBeenCalled();
      expect(service.isConnected()).toBe(true);

      // Send message
      service.send('test', { data: 'test' });
      expect(mockSocket.emit).toHaveBeenCalled();

      // Disconnect
      mockSocket.connected = false;
      service.disconnect();
      expect(disconnectedSpy).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
    });
  });
});
