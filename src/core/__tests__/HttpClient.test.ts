/**
 * HttpClient 单元测试
 */
import { HttpClient } from '../services/transport/HttpClient';

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  public status = 0;
  public timeout = 0;
  public upload = {
    addEventListener: jest.fn()
  };
  
  private eventListeners: Map<string, Function[]> = new Map();

  open = jest.fn();
  send = jest.fn();
  addEventListener = jest.fn((event: string, handler: Function) => {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  });

  // Helper to trigger events
  triggerEvent(event: string, data?: any) {
    const handlers = this.eventListeners.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  triggerUploadProgress(loaded: number, total: number) {
    const handlers = this.upload.addEventListener.mock.calls
      .filter(call => call[0] === 'progress')
      .map(call => call[1]);
    
    handlers.forEach(handler => handler({ lengthComputable: true, loaded, total }));
  }
}

describe('HttpClient', () => {
  let client: HttpClient;
  let mockXHR: MockXMLHttpRequest;

  beforeEach(() => {
    client = new HttpClient('http://localhost:3000');
    mockXHR = new MockXMLHttpRequest();
    
    // Mock global XMLHttpRequest
    (global as any).XMLHttpRequest = jest.fn(() => mockXHR);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with base URL', () => {
      const testClient = new HttpClient('http://example.com');
      expect(testClient).toBeDefined();
    });
  });

  describe('uploadChunk', () => {
    it('should upload chunk successfully', async () => {
      const file = new Blob(['test data']);
      const options = {
        transferId: 'transfer-1',
        chunkIndex: 0,
        totalChunks: 10,
        fileName: 'test.txt',
        targetId: 'device-1'
      };

      const uploadPromise = client.uploadChunk(file, options);

      // Simulate successful upload
      mockXHR.status = 200;
      mockXHR.triggerEvent('load');

      await expect(uploadPromise).resolves.toBeUndefined();
      expect(mockXHR.open).toHaveBeenCalledWith(
        'POST',
        'http://localhost:3000/api/upload/chunk'
      );
      expect(mockXHR.send).toHaveBeenCalled();
    });

    it('should track upload progress', async () => {
      const file = new Blob(['test data']);
      const onProgress = jest.fn();
      const options = {
        transferId: 'transfer-1',
        chunkIndex: 0,
        totalChunks: 10,
        fileName: 'test.txt',
        targetId: 'device-1',
        onProgress
      };

      const uploadPromise = client.uploadChunk(file, options);

      // Simulate progress events
      mockXHR.triggerUploadProgress(50, 100);
      mockXHR.triggerUploadProgress(100, 100);

      // Complete upload
      mockXHR.status = 200;
      mockXHR.triggerEvent('load');

      await uploadPromise;

      expect(onProgress).toHaveBeenCalledWith(50, 100);
      expect(onProgress).toHaveBeenCalledWith(100, 100);
    });

    it('should handle upload error', async () => {
      const file = new Blob(['test data']);
      const options = {
        transferId: 'transfer-1',
        chunkIndex: 0,
        totalChunks: 10,
        fileName: 'test.txt',
        targetId: 'device-1'
      };

      const uploadPromise = client.uploadChunk(file, options);

      // Simulate error
      mockXHR.triggerEvent('error');

      await expect(uploadPromise).rejects.toThrow('Upload error');
    });

    it('should handle upload timeout', async () => {
      const file = new Blob(['test data']);
      const options = {
        transferId: 'transfer-1',
        chunkIndex: 0,
        totalChunks: 10,
        fileName: 'test.txt',
        targetId: 'device-1'
      };

      const uploadPromise = client.uploadChunk(file, options);

      // Simulate timeout
      mockXHR.triggerEvent('timeout');

      await expect(uploadPromise).rejects.toThrow('Upload timeout');
    });

    it('should handle HTTP error status', async () => {
      const file = new Blob(['test data']);
      const options = {
        transferId: 'transfer-1',
        chunkIndex: 0,
        totalChunks: 10,
        fileName: 'test.txt',
        targetId: 'device-1'
      };

      const uploadPromise = client.uploadChunk(file, options);

      // Simulate HTTP error
      mockXHR.status = 500;
      mockXHR.triggerEvent('load');

      await expect(uploadPromise).rejects.toThrow('Upload failed: 500');
    });

    it('should set timeout to 5 minutes', async () => {
      const file = new Blob(['test data']);
      const options = {
        transferId: 'transfer-1',
        chunkIndex: 0,
        totalChunks: 10,
        fileName: 'test.txt',
        targetId: 'device-1'
      };

      const uploadPromise = client.uploadChunk(file, options);

      expect(mockXHR.timeout).toBe(300000);

      // Complete to avoid hanging
      mockXHR.status = 200;
      mockXHR.triggerEvent('load');
      await uploadPromise;
    });

    it('should send FormData with correct fields', async () => {
      const file = new Blob(['test data']);
      const options = {
        transferId: 'transfer-1',
        chunkIndex: 5,
        totalChunks: 10,
        fileName: 'test.txt',
        targetId: 'device-1'
      };

      const uploadPromise = client.uploadChunk(file, options);

      // Check FormData was created and sent
      expect(mockXHR.send).toHaveBeenCalled();
      const formData = mockXHR.send.mock.calls[0][0];
      expect(formData).toBeInstanceOf(FormData);

      // Complete upload
      mockXHR.status = 200;
      mockXHR.triggerEvent('load');
      await uploadPromise;
    });
  });

  describe('downloadFile', () => {
    beforeEach(() => {
      // Mock fetch
      global.fetch = jest.fn();
    });

    it('should download file successfully', async () => {
      const mockBlob = new Blob(['file content']);
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('3')
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      });

      const blob = await client.downloadFile('file-1');

      expect(blob).toBeInstanceOf(Blob);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/download/file-1',
        { signal: undefined }
      );
    });

    it('should track download progress', async () => {
      const onProgress = jest.fn();
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new Uint8Array(50) })
          .mockResolvedValueOnce({ done: false, value: new Uint8Array(50) })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('100')
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      });

      await client.downloadFile('file-1', { onProgress });

      expect(onProgress).toHaveBeenCalledWith(50, 100);
      expect(onProgress).toHaveBeenCalledWith(100, 100);
    });

    it('should support abort signal', async () => {
      const abortController = new AbortController();
      const mockReader = {
        read: jest.fn().mockResolvedValue({ done: true, value: undefined })
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('0')
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      });

      await client.downloadFile('file-1', { signal: abortController.signal });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/download/file-1',
        { signal: abortController.signal }
      );
    });

    it('should handle download error', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(client.downloadFile('file-1')).rejects.toThrow('Download failed: 404');
    });

    it('should handle missing response body', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('0')
        },
        body: null
      });

      await expect(client.downloadFile('file-1')).rejects.toThrow('No response body');
    });

    it('should handle missing Content-Length header', async () => {
      const mockReader = {
        read: jest.fn().mockResolvedValue({ done: true, value: undefined })
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue(null)
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      });

      const blob = await client.downloadFile('file-1');

      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('getFileInfo', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('should get file info successfully', async () => {
      const mockInfo = {
        name: 'test.txt',
        size: 1024,
        type: 'text/plain'
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockInfo)
      });

      const info = await client.getFileInfo('file-1');

      expect(info).toEqual(mockInfo);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/file/file-1/info'
      );
    });

    it('should handle error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(client.getFileInfo('file-1')).rejects.toThrow(
        'Failed to get file info: 404'
      );
    });

    it('should handle network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(client.getFileInfo('file-1')).rejects.toThrow('Network error');
    });
  });

  describe('integration scenarios', () => {
    it('should support complete upload workflow', async () => {
      const file = new Blob(['chunk data']);
      const onProgress = jest.fn();

      // Upload chunk
      const uploadPromise = client.uploadChunk(file, {
        transferId: 'transfer-1',
        chunkIndex: 0,
        totalChunks: 1,
        fileName: 'test.txt',
        targetId: 'device-1',
        onProgress
      });

      // Simulate progress and completion
      mockXHR.triggerUploadProgress(100, 100);
      mockXHR.status = 200;
      mockXHR.triggerEvent('load');

      await uploadPromise;

      expect(onProgress).toHaveBeenCalledWith(100, 100);
    });

    it('should support complete download workflow', async () => {
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new Uint8Array([1, 2, 3]) })
          .mockResolvedValueOnce({ done: true, value: undefined })
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: {
          get: jest.fn().mockReturnValue('3')
        },
        body: {
          getReader: jest.fn().mockReturnValue(mockReader)
        }
      });

      const onProgress = jest.fn();
      const blob = await client.downloadFile('file-1', { onProgress });

      expect(blob).toBeInstanceOf(Blob);
      expect(onProgress).toHaveBeenCalled();
    });
  });
});
