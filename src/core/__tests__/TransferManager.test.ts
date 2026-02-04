/**
 * TransferManager 单元测试
 */
import { TransferManager } from '../services/transfer/TransferManager';

describe('TransferManager', () => {
  let manager: TransferManager;

  beforeEach(() => {
    manager = new TransferManager();
  });

  afterEach(() => {
    manager.removeAllListeners();
  });

  describe('createTransfer', () => {
    it('should create a transfer with correct properties', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      const transfer = manager.createTransfer(file, 'device-1');

      expect(transfer).toBeDefined();
      expect(transfer.id).toBeDefined();
      expect(transfer.fileName).toBe('test.txt');
      expect(transfer.fileSize).toBe(4);
      expect(transfer.targetId).toBe('device-1');
      expect(transfer.status).toBe('pending');
      expect(transfer.progress).toBe(0);
    });

    it('should emit transfer-created event', (done) => {
      const file = new File(['test'], 'test.txt');
      
      manager.on('transfer-created', (transfer) => {
        expect(transfer.fileName).toBe('test.txt');
        done();
      });

      manager.createTransfer(file, 'device-1');
    });
  });

  describe('start', () => {
    it('should start a transfer', async () => {
      const file = new File(['test'], 'test.txt');
      const transfer = manager.createTransfer(file, 'device-1');

      const startPromise = manager.start(transfer.id);
      
      expect(transfer.status).toBe('active');
      
      await startPromise;
      
      expect(transfer.status).toBe('completed');
    });

    it('should emit transfer-started event', (done) => {
      const file = new File(['test'], 'test.txt');
      const transfer = manager.createTransfer(file, 'device-1');

      manager.on('transfer-started', (t) => {
        expect(t.id).toBe(transfer.id);
        done();
      });

      manager.start(transfer.id);
    });

    it('should throw error for non-existent transfer', async () => {
      await expect(manager.start('non-existent')).rejects.toThrow();
    });
  });

  describe('pause', () => {
    it('should pause an active transfer', async () => {
      const file = new File(['test'], 'test.txt');
      const transfer = manager.createTransfer(file, 'device-1');

      manager.start(transfer.id);
      manager.pause(transfer.id);

      expect(transfer.status).toBe('paused');
    });
  });

  describe('cancel', () => {
    it('should cancel a transfer', () => {
      const file = new File(['test'], 'test.txt');
      const transfer = manager.createTransfer(file, 'device-1');

      manager.cancel(transfer.id);

      expect(transfer.status).toBe('failed');
      expect(transfer.error?.message).toBe('Transfer cancelled');
    });
  });

  describe('getTransfer', () => {
    it('should return transfer by id', () => {
      const file = new File(['test'], 'test.txt');
      const transfer = manager.createTransfer(file, 'device-1');

      const found = manager.getTransfer(transfer.id);

      expect(found).toBe(transfer);
    });

    it('should return null for non-existent transfer', () => {
      const found = manager.getTransfer('non-existent');

      expect(found).toBeNull();
    });
  });

  describe('getAllTransfers', () => {
    it('should return all transfers', () => {
      const file1 = new File(['test1'], 'test1.txt');
      const file2 = new File(['test2'], 'test2.txt');

      manager.createTransfer(file1, 'device-1');
      manager.createTransfer(file2, 'device-2');

      const transfers = manager.getAllTransfers();

      expect(transfers).toHaveLength(2);
    });
  });

  describe('getActiveTransfers', () => {
    it('should return only active transfers', async () => {
      const file1 = new File(['test1'], 'test1.txt');
      const file2 = new File(['test2'], 'test2.txt');

      const transfer1 = manager.createTransfer(file1, 'device-1');
      manager.createTransfer(file2, 'device-2');

      manager.start(transfer1.id);

      const activeTransfers = manager.getActiveTransfers();

      expect(activeTransfers).toHaveLength(1);
      expect(activeTransfers[0].id).toBe(transfer1.id);
    });
  });
});
