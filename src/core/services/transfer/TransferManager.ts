import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface Transfer {
  id: string;
  fileName: string;
  fileSize: number;
  targetId: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'failed';
  progress: number;
  speed: number;
  startTime?: number;
  endTime?: number;
  error?: Error;
}

export interface TransferOptions {
  chunkSize?: number;
  maxConcurrent?: number;
  onProgress?: (progress: number) => void;
}

export class TransferManager extends EventEmitter {
  private transfers: Map<string, Transfer> = new Map();
  private activeTransfers: Set<string> = new Set();
  private maxConcurrent: number = 3;

  createTransfer(file: File, targetId: string, options?: TransferOptions): Transfer {
    const transfer: Transfer = {
      id: uuidv4(),
      fileName: file.name,
      fileSize: file.size,
      targetId,
      status: 'pending',
      progress: 0,
      speed: 0
    };

    this.transfers.set(transfer.id, transfer);
    this.emit('transfer-created', transfer);

    return transfer;
  }

  async start(transferId: string): Promise<void> {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      throw new Error(`Transfer ${transferId} not found`);
    }

    if (this.activeTransfers.size >= this.maxConcurrent) {
      throw new Error('Max concurrent transfers reached');
    }

    transfer.status = 'active';
    transfer.startTime = Date.now();
    this.activeTransfers.add(transferId);

    this.emit('transfer-started', transfer);

    try {
      await this.executeTransfer(transfer);
      transfer.status = 'completed';
      transfer.endTime = Date.now();
      this.emit('transfer-completed', transfer);
    } catch (error) {
      transfer.status = 'failed';
      transfer.error = error as Error;
      this.emit('transfer-failed', transfer);
    } finally {
      this.activeTransfers.delete(transferId);
    }
  }

  pause(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (transfer && transfer.status === 'active') {
      transfer.status = 'paused';
      this.activeTransfers.delete(transferId);
      this.emit('transfer-paused', transfer);
    }
  }

  resume(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (transfer && transfer.status === 'paused') {
      this.start(transferId);
    }
  }

  cancel(transferId: string): void {
    const transfer = this.transfers.get(transferId);
    if (transfer) {
      transfer.status = 'failed';
      transfer.error = new Error('Transfer cancelled');
      this.activeTransfers.delete(transferId);
      this.emit('transfer-cancelled', transfer);
    }
  }

  getTransfer(id: string): Transfer | null {
    return this.transfers.get(id) || null;
  }

  getAllTransfers(): Transfer[] {
    return Array.from(this.transfers.values());
  }

  getActiveTransfers(): Transfer[] {
    return Array.from(this.activeTransfers)
      .map(id => this.transfers.get(id))
      .filter((t): t is Transfer => t !== undefined);
  }

  private async executeTransfer(transfer: Transfer): Promise<void> {
    // TODO: 实际传输逻辑将在 Phase 2 实现
    // 这里只是占位符，模拟传输过程
    console.log(`[TransferManager] Starting transfer: ${transfer.fileName}`);
    
    // 模拟进度更新
    for (let i = 0; i <= 100; i += 10) {
      transfer.progress = i;
      this.emit('transfer-progress', transfer);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
