/**
 * 移动端服务管理器
 */
import { UnifiedTransportService } from '../../core/services/transport/UnifiedTransport';
import { TransferManager } from '../../core/services/transfer/TransferManager';
import { HttpClient } from '../../core/services/transport/HttpClient';
import { ChunkManager } from '../../core/services/transfer/ChunkManager';
import { ResumeManager } from '../../core/services/transfer/ResumeManager';
import { useAppStore } from '../../core/store';
import { retryWithBackoff } from '../../core/utils/retry';
import { handleError } from '../../core/utils/ErrorHandler';

export class MobileServiceManager {
  private static instance: MobileServiceManager;
  private transport: UnifiedTransportService | null = null;
  private transferManager: TransferManager | null = null;
  private httpClient: HttpClient | null = null;
  private resumeManager: ResumeManager | null = null;

  private constructor() {}

  static getInstance(): MobileServiceManager {
    if (!MobileServiceManager.instance) {
      MobileServiceManager.instance = new MobileServiceManager();
    }
    return MobileServiceManager.instance;
  }

  async initialize(serverUrl: string): Promise<void> {
    try {
      // 1. 初始化传输服务
      this.transport = new UnifiedTransportService({ url: serverUrl });
      await this.transport.connect();

      // 2. 初始化传输管理器
      this.transferManager = new TransferManager();
      this.setupTransferListeners();

      // 3. 初始化 HTTP 客户端
      this.httpClient = new HttpClient(serverUrl);

      // 4. 初始化断点续传管理器
      this.resumeManager = new ResumeManager();
      await this.resumeManager.initialize();

      // 5. 设置连接状态
      useAppStore.getState().setConnected(true);

      console.log('[MobileServiceManager] Initialized successfully');
    } catch (error) {
      console.error('[MobileServiceManager] Initialization failed:', error);
      handleError({
        type: 'network',
        message: 'Failed to connect to server',
        details: error
      });
      throw error;
    }
  }

  private setupTransferListeners(): void {
    if (!this.transferManager) return;

    this.transferManager.on('transfer-created', (transfer) => {
      useAppStore.getState().addTransfer(transfer);
    });

    this.transferManager.on('transfer-progress', (transfer) => {
      useAppStore.getState().updateTransfer(transfer.id, {
        progress: transfer.progress,
        speed: transfer.speed
      });
    });

    this.transferManager.on('transfer-completed', (transfer) => {
      useAppStore.getState().updateTransfer(transfer.id, {
        status: 'completed',
        progress: 100
      });
    });

    this.transferManager.on('transfer-failed', (transfer) => {
      useAppStore.getState().updateTransfer(transfer.id, {
        status: 'failed',
        error: transfer.error
      });
    });
  }

  /**
   * 发送文件（带分片和断点续传）
   */
  async sendFile(file: File, targetDeviceId: string): Promise<void> {
    if (!this.transferManager || !this.httpClient) {
      throw new Error('Services not initialized');
    }

    const transfer = this.transferManager.createTransfer(file, targetDeviceId);
    const chunkManager = new ChunkManager(file);

    try {
      await this.transferManager.start(transfer.id);

      const totalChunks = chunkManager.getTotalChunks();

      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunkManager.getChunk(i);
        if (!chunk) continue;

        // 使用重试机制上传分片
        await retryWithBackoff(
          () => this.httpClient!.uploadChunk(chunk.data, {
            transferId: transfer.id,
            chunkIndex: i,
            totalChunks,
            fileName: file.name,
            targetId: targetDeviceId,
            onProgress: (loaded, total) => {
              const chunkProgress = (loaded / total) * 100;
              const overallProgress = ((i + chunkProgress / 100) / totalChunks) * 100;
              
              useAppStore.getState().updateTransfer(transfer.id, {
                progress: overallProgress
              });

              // 同步进度到服务器
              this.transport?.send('upload-progress-sync', {
                fileName: file.name,
                percent: overallProgress,
                sentSize: i * 1024 * 1024 + loaded,
                totalSize: file.size
              });
            }
          }),
          {
            maxRetries: 3,
            onRetry: (attempt, error) => {
              console.log(`Retrying chunk ${i}, attempt ${attempt}:`, error);
            }
          }
        );

        chunkManager.markChunkUploaded(i);

        // 保存断点续传状态
        if (this.resumeManager) {
          await this.resumeManager.saveTransferState(
            transfer.id,
            file.name,
            file.size,
            Array.from({ length: i + 1 }, (_, idx) => idx),
            totalChunks
          );
        }
      }

      // 完成传输
      useAppStore.getState().updateTransfer(transfer.id, {
        status: 'completed',
        progress: 100
      });

      // 清理断点续传状态
      if (this.resumeManager) {
        await this.resumeManager.deleteTransferState(transfer.id);
      }

    } catch (error) {
      handleError({
        type: 'transfer',
        message: 'Failed to send file',
        details: error
      });

      useAppStore.getState().updateTransfer(transfer.id, {
        status: 'failed',
        error: error as Error
      });

      throw error;
    }
  }

  /**
   * 接收文件
   */
  async receiveFile(fileId: string, fileName: string): Promise<void> {
    if (!this.httpClient) {
      throw new Error('HTTP client not initialized');
    }

    try {
      const blob = await this.httpClient.downloadFile(fileId, {
        onProgress: (loaded, total) => {
          const progress = (loaded / total) * 100;
          
          // 同步进度到服务器
          this.transport?.send('download-progress-sync', {
            itemId: fileId,
            fileName,
            percent: progress,
            receivedSize: loaded,
            totalSize: total
          });
        }
      });

      // 保存文件
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      console.log('[MobileServiceManager] File received successfully');
    } catch (error) {
      handleError({
        type: 'transfer',
        message: 'Failed to receive file',
        details: error
      });
      throw error;
    }
  }

  getTransport(): UnifiedTransportService | null {
    return this.transport;
  }

  getTransferManager(): TransferManager | null {
    return this.transferManager;
  }

  getHttpClient(): HttpClient | null {
    return this.httpClient;
  }

  async cleanup(): Promise<void> {
    this.transport?.disconnect();
    this.transferManager?.removeAllListeners();
    useAppStore.getState().setConnected(false);
  }
}
