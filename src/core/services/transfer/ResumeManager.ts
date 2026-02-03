import { openDB, DBSchema, IDBPDatabase } from 'idb';

/**
 * 断点续传管理器 - 使用 IndexedDB 存储传输状态
 */
interface TransferDB extends DBSchema {
  transfers: {
    key: string;
    value: {
      id: string;
      fileName: string;
      fileSize: number;
      uploadedChunks: number[];
      totalChunks: number;
      createdAt: number;
      updatedAt: number;
    };
  };
}

export class ResumeManager {
  private db: IDBPDatabase<TransferDB> | null = null;

  async initialize(): Promise<void> {
    this.db = await openDB<TransferDB>('airdrop-transfers', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('transfers')) {
          db.createObjectStore('transfers', { keyPath: 'id' });
        }
      }
    });
  }

  async saveTransferState(
    id: string,
    fileName: string,
    fileSize: number,
    uploadedChunks: number[],
    totalChunks: number
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.put('transfers', {
      id,
      fileName,
      fileSize,
      uploadedChunks,
      totalChunks,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  async loadTransferState(id: string) {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.get('transfers', id);
  }

  async deleteTransferState(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.delete('transfers', id);
  }

  async getAllTransfers() {
    if (!this.db) throw new Error('Database not initialized');
    return await this.db.getAll('transfers');
  }

  async clearOldTransfers(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const allTransfers = await this.getAllTransfers();
    
    for (const transfer of allTransfers) {
      if (now - transfer.updatedAt > maxAge) {
        await this.deleteTransferState(transfer.id);
      }
    }
  }
}
