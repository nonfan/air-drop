/**
 * 文件下载管理 Hook
 */
import { useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../utils';
import { WEB_CONFIG } from '../config';

export function useDownload(socket: Socket | null) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadFailedId, setDownloadFailedId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: number }>({});
  
  // 移动端和桌面端都不保存已下载状态，允许重复下载
  const [downloadedIds] = useState<Set<string>>(new Set()); // 始终为空，不保存已下载状态
  
  const [downloadFailedIds, setDownloadFailedIds] = useState<Set<string>>(() => {
    return new Set(getStorageItem<string[]>(STORAGE_KEYS.DOWNLOAD_FAILED_IDS, []));
  });

  // 下载文件
  const downloadFile = useCallback(async (filePath: string, fileName: string, itemId: string) => {
    // 清除当前项的失败状态（如果是重试）
    if (downloadFailedIds.has(itemId)) {
      const newFailedIds = new Set(downloadFailedIds);
      newFailedIds.delete(itemId);
      setDownloadFailedIds(newFailedIds);
      setStorageItem(STORAGE_KEYS.DOWNLOAD_FAILED_IDS, Array.from(newFailedIds));
    }

    // 只清除当前项的临时失败状态
    if (downloadFailedId === itemId) {
      setDownloadFailedId(null);
    }

    setDownloadingId(itemId);
    setDownloadProgress(prev => ({ ...prev, [itemId]: 0 }));

    try {
      console.log('[Download] Starting download:', fileName, filePath);

      // 构建完整的下载 URL
      let downloadUrl = filePath;
      if (filePath.startsWith('/')) {
        const isDev = import.meta.env?.DEV;
        const serverUrl = isDev ? `http://localhost:${WEB_CONFIG.FIXED_IP.PORT}` : window.location.origin;
        downloadUrl = `${serverUrl}${filePath}`;
      }

      console.log('[Download] Download URL:', downloadUrl);

      // 使用 Fetch + ReadableStream 方式下载，支持进度显示
      console.log('[Download] Using streaming download with progress');
      
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // 获取文件总大小
      const contentLength = response.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      // 检测是否为 iOS 设备
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      
      if (total > 0 && response.body) {
        // 支持进度的流式下载
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let receivedLength = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          chunks.push(value);
          receivedLength += value.length;
          
          // 更新本地进度
          const percent = Math.round((receivedLength / total) * 100);
          setDownloadProgress(prev => ({ ...prev, [itemId]: percent }));
          
          // 同步进度给桌面端（通过 Socket.IO）
          if (socket && socket.connected) {
            socket.emit('download-progress-sync', {
              itemId,
              fileName,
              percent,
              receivedSize: receivedLength,
              totalSize: total
            });
          }
        }
        
        // 下载完成，显示 100% 进度
        setDownloadProgress(prev => ({ ...prev, [itemId]: 100 }));
        
        // 同步最终进度给桌面端
        if (socket && socket.connected) {
          socket.emit('download-progress-sync', {
            itemId,
            fileName,
            percent: 100,
            receivedSize: total,
            totalSize: total
          });
        }
        
        // 合并所有块
        const blob = new Blob(chunks);
        const blobUrl = URL.createObjectURL(blob);
        
        // 触发下载
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        // 延迟清理，让用户看到 100% 完成状态
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
          
          // 清除进度状态
          setDownloadingId(null);
          setDownloadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[itemId];
            return newProgress;
          });
        }, 500);
        
      } else {
        // 不支持进度的下载（无 Content-Length 或无 body）
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        
        // 延迟清理
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
          
          // 清除进度状态
          setDownloadingId(null);
          setDownloadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[itemId];
            return newProgress;
          });
        }, 500);
      }

      console.log('[Download] Download triggered successfully');

      // 移动端和桌面端都不保存已下载状态，允许重复下载
      // 不再标记为已下载，用户可以随时再次点击下载

    } catch (error) {
      console.error('[Download] Download error:', error);
      setDownloadingId(null);
      setDownloadFailedId(itemId);
      setDownloadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[itemId];
        return newProgress;
      });
      
      // 标记为下载失败并保存到 localStorage
      const newFailedIds = new Set(downloadFailedIds).add(itemId);
      setDownloadFailedIds(newFailedIds);
      setStorageItem(STORAGE_KEYS.DOWNLOAD_FAILED_IDS, Array.from(newFailedIds));

      // 通知服务器下载失败
      if (socket && socket.connected) {
        socket.emit('download-failed', {
          fileName,
          filePath
        });
      }
    }
  }, [downloadedIds, downloadFailedIds, downloadFailedId, socket]);

  return {
    downloadingId,
    downloadFailedId,
    downloadedIds,
    downloadFailedIds,
    downloadProgress,
    downloadFile
  };
}
