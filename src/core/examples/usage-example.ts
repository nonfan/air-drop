/**
 * 新架构使用示例
 * 这个文件展示了如何使用重构后的服务
 */

import { UnifiedTransportService } from '../services/transport/UnifiedTransport';
import { TransferManager } from '../services/transfer/TransferManager';
import { ChunkManager } from '../services/transfer/ChunkManager';
import { HttpClient } from '../services/transport/HttpClient';
import { DiscoveryService } from '../services/discovery/DiscoveryService';
import { useAppStore } from '../store';
import { retryWithBackoff } from '../utils/retry';
import { handleError } from '../utils/ErrorHandler';

/**
 * 示例 1: 初始化服务
 */
export async function initializeServices() {
  // 1. 创建传输服务
  const transport = new UnifiedTransportService({
    url: 'http://localhost:8080'
  });

  // 2. 连接到服务器
  await transport.connect();

  // 3. 创建传输管理器
  const transferManager = new TransferManager();

  // 4. 创建 HTTP 客户端
  const httpClient = new HttpClient('http://localhost:8080');

  // 5. 启动设备发现
  const discovery = new DiscoveryService();
  await discovery.start();

  // 6. 监听设备发现事件
  discovery.on('device-found', (device) => {
    console.log('Found device:', device);
    useAppStore.getState().addDevice(device);
  });

  discovery.on('device-lost', (deviceId) => {
    console.log('Lost device:', deviceId);
    useAppStore.getState().removeDevice(deviceId);
  });

  return { transport, transferManager, httpClient, discovery };
}

/**
 * 示例 2: 发送文件（带分片）
 */
export async function sendFileWithChunks(
  file: File,
  targetDeviceId: string,
  httpClient: HttpClient,
  transferManager: TransferManager
) {
  // 1. 创建传输任务
  const transfer = transferManager.createTransfer(file, targetDeviceId);

  // 2. 创建分片管理器
  const chunkManager = new ChunkManager(file);

  // 3. 开始传输
  try {
    await transferManager.start(transfer.id);

    // 4. 上传每个分片
    const totalChunks = chunkManager.getTotalChunks();
    
    for (let i = 0; i < totalChunks; i++) {
      const chunk = chunkManager.getChunk(i);
      if (!chunk) continue;

      // 使用重试机制上传分片
      await retryWithBackoff(
        () => httpClient.uploadChunk(chunk.data, {
          transferId: transfer.id,
          chunkIndex: i,
          totalChunks,
          fileName: file.name,
          targetId: targetDeviceId,
          onProgress: (loaded, total) => {
            const chunkProgress = (loaded / total) * 100;
            const overallProgress = ((i + chunkProgress / 100) / totalChunks) * 100;
            
            // 更新进度
            useAppStore.getState().updateTransfer(transfer.id, {
              progress: overallProgress
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

      // 标记分片已上传
      chunkManager.markChunkUploaded(i);
    }

    // 5. 完成传输
    useAppStore.getState().updateTransfer(transfer.id, {
      status: 'completed',
      progress: 100
    });

    console.log('File sent successfully!');
  } catch (error) {
    // 错误处理
    handleError({
      type: 'transfer',
      message: 'Failed to send file',
      details: error
    });

    useAppStore.getState().updateTransfer(transfer.id, {
      status: 'failed',
      error: error as Error
    });
  }
}

/**
 * 示例 3: 接收文件
 */
export async function receiveFile(
  fileId: string,
  httpClient: HttpClient
) {
  try {
    // 1. 获取文件信息
    const fileInfo = await httpClient.getFileInfo(fileId);

    // 2. 下载文件
    const blob = await httpClient.downloadFile(fileId, {
      onProgress: (loaded, total) => {
        const progress = (loaded / total) * 100;
        console.log(`Download progress: ${progress.toFixed(2)}%`);
      }
    });

    // 3. 保存文件
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileInfo.name;
    a.click();
    URL.revokeObjectURL(url);

    console.log('File received successfully!');
  } catch (error) {
    handleError({
      type: 'transfer',
      message: 'Failed to receive file',
      details: error
    });
  }
}

/**
 * 示例 4: 使用 Zustand Store
 */
export function useDeviceManagement() {
  // 获取状态
  const devices = useAppStore(state => state.devices);
  const currentDevice = useAppStore(state => state.currentDevice);

  // 获取 actions
  const addDevice = useAppStore(state => state.addDevice);
  const removeDevice = useAppStore(state => state.removeDevice);
  const setCurrentDevice = useAppStore(state => state.setCurrentDevice);

  // 业务逻辑
  const selectDevice = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device) {
      setCurrentDevice(device);
    }
  };

  return {
    devices,
    currentDevice,
    addDevice,
    removeDevice,
    selectDevice
  };
}

/**
 * 示例 5: 监听传输进度
 */
export function setupTransferListeners(transferManager: TransferManager) {
  transferManager.on('transfer-created', (transfer) => {
    console.log('Transfer created:', transfer);
    useAppStore.getState().addTransfer(transfer);
  });

  transferManager.on('transfer-started', (transfer) => {
    console.log('Transfer started:', transfer);
    useAppStore.getState().updateTransfer(transfer.id, {
      status: 'active'
    });
  });

  transferManager.on('transfer-progress', (transfer) => {
    useAppStore.getState().updateTransfer(transfer.id, {
      progress: transfer.progress,
      speed: transfer.speed
    });
  });

  transferManager.on('transfer-completed', (transfer) => {
    console.log('Transfer completed:', transfer);
    useAppStore.getState().updateTransfer(transfer.id, {
      status: 'completed',
      progress: 100
    });
  });

  transferManager.on('transfer-failed', (transfer) => {
    console.log('Transfer failed:', transfer);
    useAppStore.getState().updateTransfer(transfer.id, {
      status: 'failed',
      error: transfer.error
    });
  });
}
