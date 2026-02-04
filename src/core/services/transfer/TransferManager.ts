import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

export interface Transfer {
  id: string;
  fileName: string;
  fileSize: number;
  filePath?: string;
  targetId: string;
  status: 'pending' | 'active' | 'paused' | 'completed' | 'failed';
  progress: number;
  speed: number;
  sentSize: number;
  totalSize: number;
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
      filePath: (file as any).path, // Node.js File 对象可能有 path 属性
      targetId,
      status: 'pending',
      progress: 0,
      speed: 0,
      sentSize: 0,
      totalSize: file.size
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
      transfer.progress = 100;
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

  /**
   * 设置传输处理器（由外部注入）
   */
  setTransferHandler(handler: (transfer: Transfer) => Promise<void>) {
    this.transferHandler = handler;
  }

  private transferHandler?: (transfer: Transfer) => Promise<void>;

  private async executeTransfer(transfer: Transfer): Promise<void> {
    console.log(`[TransferManager] Starting transfer: ${transfer.fileName} to ${transfer.targetId}`);
    
    // 如果有外部传输处理器，使用它
    if (this.transferHandler) {
      try {
        await this.transferHandler(transfer);
        return;
      } catch (error) {
        console.error('[TransferManager] Transfer handler error:', error);
        throw error;
      }
    }
    
    // 否则使用模拟传输（用于测试）
    console.log('[TransferManager] Using simulated transfer (no handler set)');
    const steps = 10;
    const stepDelay = 100;
    
    for (let i = 0; i <= steps; i++) {
      if (transfer.status !== 'active') {
        throw new Error('Transfer interrupted');
      }
      
      transfer.progress = (i / steps) * 100;
      transfer.sentSize = Math.floor((transfer.totalSize * i) / steps);
      
      // 计算速度 (bytes per second)
      if (transfer.startTime) {
        const elapsed = (Date.now() - transfer.startTime) / 1000;
        transfer.speed = elapsed > 0 ? transfer.sentSize / elapsed : 0;
      }
      
      this.emit('transfer-progress', transfer);
      
      if (i < steps) {
        await new Promise(resolve => setTimeout(resolve, stepDelay));
      }
    }
    
    console.log(`[TransferManager] Transfer completed: ${transfer.fileName}`);
  }
}

