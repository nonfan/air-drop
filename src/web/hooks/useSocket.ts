/**
 * Socket.IO 连接管理 Hook
 */
import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '../utils';
import type { Device, HistoryItem } from '../types';
import { getSocketUrl } from '../config';

interface UseSocketOptions {
  deviceName: string;
  onDevicesUpdate: (devices: Device[]) => void;
  onHistoryItemReceived: (item: HistoryItem) => void;
  onNotification: (title: string, body: string) => void;
  onAppVersionReceived: (version: string) => void;
  onSendProgressUpdate: (progress: { percent: number; currentFile: string; totalSize: number; sentSize: number }) => void;
  onDownloadProgressUpdate: (progress: { percent: number; currentFile: string; totalSize: number; sentSize: number }) => void;
  onSendComplete: () => void;
  onSendError: () => void;
}

export function useSocket(options: UseSocketOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // 使用 ref 存储回调函数，避免依赖变化导致 socket 重新创建
  const callbacksRef = useRef(options);

  // 更新 ref 中的回调函数
  useEffect(() => {
    callbacksRef.current = options;
  }, [options]);

  const { deviceName } = options;

  useEffect(() => {
    const isDev = import.meta.env.DEV;
    
    // 使用配置文件中的固定 IP 和端口
    const socketUrl = getSocketUrl();
    
    console.log('[Socket.IO] Connecting to fixed IP:', socketUrl);

    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity
    });

    // 连接事件
    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected, requesting devices...');
      setIsConnected(true);
      
      // 立即设置设备名称
      socketInstance.emit('set-name', {
        name: deviceName,
        model: navigator.userAgent
      });
      
      // 立即请求设备列表
      socketInstance.emit('get-devices');
      
      // 连接后短时间内多次请求，确保快速获取设备列表
      setTimeout(() => socketInstance.emit('get-devices'), 500);
      setTimeout(() => socketInstance.emit('get-devices'), 1000);
      setTimeout(() => socketInstance.emit('get-devices'), 2000);
    });

    socketInstance.on('connected', (data: { clientId: string; deviceName: string; appVersion: string }) => {
      console.log('[Socket.IO] Server confirmed connection:', data);
      if (data.appVersion) {
        callbacksRef.current.onAppVersionReceived(data.appVersion);
      }

      // 收到服务器确认后，再次请求设备列表
      socketInstance.emit('get-devices');
      setTimeout(() => socketInstance.emit('get-devices'), 500);
    });

    // 设备列表更新
    socketInstance.on('devices-updated', (data: { devices: Device[] }) => {
      console.log('[Socket.IO] Received devices-updated:', data.devices);
      callbacksRef.current.onDevicesUpdate(data.devices);
    });

    // 文件和文本更新
    socketInstance.on('files-updated', (data: { files: any[]; texts: any[] }) => {
      if (data.texts && data.texts.length > 0) {
        data.texts.forEach((textData: { id: string; text: string; preview: string }) => {
          const item: HistoryItem = {
            id: textData.id,
            type: 'text',
            content: textData.text,
            timestamp: Date.now(),
            status: 'success',
            direction: 'received',
            from: '桌面端'
          };
          callbacksRef.current.onHistoryItemReceived(item);
        });
        if (data.texts.length > 0) {
          callbacksRef.current.onNotification('收到文本消息', '来自桌面端');
        }
      }
    });

    // 来自移动端的文本
    socketInstance.on('text-from-mobile', (data: { text: string; from: string; fromId: string }) => {
      const item: HistoryItem = {
        id: Date.now().toString(),
        type: 'text',
        content: data.text,
        timestamp: Date.now(),
        status: 'success',
        direction: 'received',
        from: data.from
      };
      callbacksRef.current.onHistoryItemReceived(item);
      callbacksRef.current.onNotification('收到文本消息', `来自 ${data.from}`);
    });

    // 文本接收确认
    socketInstance.on('text-received', (data?: { id?: string; text?: string; from?: string }) => {
      if (data && data.text) {
        const item: HistoryItem = {
          id: data.id || Date.now().toString(),
          type: 'text',
          content: data.text,
          timestamp: Date.now(),
          status: 'success',
          direction: 'received',
          from: data.from || '桌面端'
        };
        callbacksRef.current.onHistoryItemReceived(item);
        callbacksRef.current.onNotification('收到文本消息', `来自 ${data.from}`);
      }
    });

    // 文件接收
    socketInstance.on('file-received', (data: { fileName: string; fileSize: number; filePath: string; from: string }) => {
      console.log('[Socket.IO] Received file-received message:', data);
      
      // 显示接收通知
      callbacksRef.current.onNotification('收到文件', `${data.fileName} 来自 ${data.from}`);
      
      // 添加到历史记录
      const item: HistoryItem = {
        id: Date.now().toString(),
        type: 'file',
        fileName: data.fileName,
        fileSize: data.fileSize,
        filePath: data.filePath,
        timestamp: Date.now(),
        status: 'success',
        direction: 'received',
        from: data.from
      };
      callbacksRef.current.onHistoryItemReceived(item);
    });

    // 进度更新
    socketInstance.on('download-progress', (data: { percent: number; fileName: string; totalSize: number; receivedSize: number }) => {
      callbacksRef.current.onDownloadProgressUpdate({
        percent: data.percent,
        currentFile: data.fileName,
        totalSize: data.totalSize,
        sentSize: data.receivedSize
      });
    });

    socketInstance.on('upload-progress', (data: { percent: number; fileName: string; totalSize: number; sentSize: number }) => {
      callbacksRef.current.onSendProgressUpdate({
        percent: data.percent,
        currentFile: data.fileName,
        totalSize: data.totalSize,
        sentSize: data.sentSize
      });
    });

    // 上传完成/错误
    socketInstance.on('upload-complete', () => callbacksRef.current.onSendComplete());
    socketInstance.on('upload-error', () => callbacksRef.current.onSendError());

    // 桌面端发送文件进度（显示为移动端的接收进度）
    socketInstance.on('desktop-send-progress', (data: { fileName: string; percent: number; sentSize: number; totalSize: number }) => {
      console.log(`[Mobile] Desktop send progress: ${data.fileName} ${data.percent}%`);
      callbacksRef.current.onDownloadProgressUpdate({
        percent: data.percent,
        currentFile: data.fileName,
        totalSize: data.totalSize,
        sentSize: data.sentSize
      });
    });

    // 错误和断开连接
    socketInstance.on('error', (error: any) => {
      console.error('Socket.IO error:', error);
    });

    socketInstance.on('disconnect', (reason: string) => {
      console.log('Socket.IO disconnected:', reason);
      setIsConnected(false);
    });

    socketInstance.on('reconnect', (attemptNumber: number) => {
      console.log('[Socket.IO] Reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      
      // 重连后立即请求设备列表
      socketInstance.emit('get-devices');
      setTimeout(() => socketInstance.emit('get-devices'), 500);
    });

    setSocket(socketInstance);

    // 定期刷新设备列表（降低频率，避免过多请求）
    const deviceRefreshInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('get-devices');
      }
    }, 5000); // 从 10 秒改为 5 秒

    return () => {
      clearInterval(deviceRefreshInterval);
      socketInstance.disconnect();
    };
  }, [deviceName]); // 只依赖 deviceName

  return { socket, isConnected };
}
