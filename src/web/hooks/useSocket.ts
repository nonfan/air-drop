/**
 * Socket.IO 连接管理 Hook
 * 优化版本：支持设备缓存、增量更新、快速连接
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

// 设备缓存键
const DEVICES_CACHE_KEY = 'airdrop_devices_cache';
const CACHE_EXPIRY_MS = 60000; // 缓存有效期 1 分钟

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
    // 如果设备名称为空，不连接
    if (!deviceName) {
      console.log('[Socket.IO] Device name not set, skipping connection');
      return;
    }

    // 1. 立即加载缓存的设备列表（提升首次显示速度）
    try {
      const cached = localStorage.getItem(DEVICES_CACHE_KEY);
      if (cached) {
        const { devices, timestamp } = JSON.parse(cached);
        const age = Date.now() - timestamp;
        
        if (age < CACHE_EXPIRY_MS) {
          console.log('[Socket.IO] Loading cached devices:', devices.length, 'age:', age, 'ms');
          callbacksRef.current.onDevicesUpdate(devices);
        } else {
          console.log('[Socket.IO] Cache expired, age:', age, 'ms');
          localStorage.removeItem(DEVICES_CACHE_KEY);
        }
      }
    } catch (e) {
      console.error('[Socket.IO] Failed to load cached devices:', e);
    }

    const isDev = import.meta.env.DEV;
    
    // 使用配置文件中的固定 IP 和端口
    const socketUrl = getSocketUrl();
    
    console.log('[Socket.IO] Connecting to:', socketUrl, 'device:', deviceName);

    // 2. 建立 Socket.IO 连接（优化配置）
    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],  // 优先 WebSocket
      reconnection: true,
      reconnectionDelay: 500,                // 快速重连
      reconnectionDelayMax: 2000,
      reconnectionAttempts: Infinity,
      timeout: 5000,                         // 5秒超时
      autoConnect: true,
      query: {
        deviceName: deviceName
      }
    });

    // 连接事件
    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected:', socketInstance.id);
      setIsConnected(true);
      
      // 立即设置设备名称
      socketInstance.emit('set-name', {
        name: deviceName,
        model: navigator.userAgent
      });
      
      // 立即请求设备列表
      socketInstance.emit('get-devices');
    });

    socketInstance.on('connected', (data: { clientId: string; deviceName: string; appVersion: string }) => {
      console.log('[Socket.IO] Server confirmed connection:', data);
      if (data.appVersion) {
        callbacksRef.current.onAppVersionReceived(data.appVersion);
      }

      // 收到服务器确认后，再次请求设备列表
      socketInstance.emit('get-devices');
    });

    // 3. 设备列表更新（全量更新）
    socketInstance.on('devices-updated', (data: { devices: Device[] }) => {
      console.log('[Socket.IO] Devices updated:', data.devices.length);
      callbacksRef.current.onDevicesUpdate(data.devices);
      
      // 更新缓存
      try {
        localStorage.setItem(DEVICES_CACHE_KEY, JSON.stringify({
          devices: data.devices,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.error('[Socket.IO] Failed to cache devices:', e);
      }
    });

    // 4. 增量更新事件（如果服务端支持）
    socketInstance.on('device-added', (device: Device) => {
      console.log('[Socket.IO] Device added:', device.name);
      // 这里可以实现增量更新逻辑
      // 暂时仍使用全量更新
      socketInstance.emit('get-devices');
    });

    socketInstance.on('device-removed', (deviceId: string) => {
      console.log('[Socket.IO] Device removed:', deviceId);
      socketInstance.emit('get-devices');
    });

    socketInstance.on('device-updated', (device: Device) => {
      console.log('[Socket.IO] Device updated:', device.name);
      socketInstance.emit('get-devices');
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

    // 文件接收开始（预先创建 History 记录）
    socketInstance.on('file-start-receiving', (data: { fileName: string; fileSize: number; from: string }) => {
      console.log('[Socket.IO] File receiving started:', data);
      
      // 预先创建一个 pending 状态的历史记录
      const item: HistoryItem = {
        id: `receiving-${Date.now()}`,
        type: 'file',
        fileName: data.fileName,
        fileSize: data.fileSize,
        filePath: '', // 暂时为空
        timestamp: Date.now(),
        status: 'downloading', // 使用 downloading 状态
        direction: 'received',
        from: data.from,
        progress: 0 // 初始进度为 0
      };
      callbacksRef.current.onHistoryItemReceived(item);
    });

    // 文件接收
    socketInstance.on('file-received', (data: { fileName: string; fileSize: number; filePath: string; from: string }) => {
      console.log('[Socket.IO] Received file-received message:', data);
      
      // 显示接收通知
      callbacksRef.current.onNotification('收到文件', `${data.fileName} 来自 ${data.from}`);
      
      // 更新历史记录为成功状态
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

    // 进度更新（同时更新 History 中的进度）
    socketInstance.on('download-progress', (data: { percent: number; fileName: string; totalSize: number; receivedSize: number }) => {
      callbacksRef.current.onDownloadProgressUpdate({
        percent: data.percent,
        currentFile: data.fileName,
        totalSize: data.totalSize,
        sentSize: data.receivedSize
      });
      
      // 同时更新 History 记录的进度
      // 这里需要通过回调更新对应文件的进度
      // 暂时通过 downloadProgressMap 实现
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

    // 5. 智能刷新设备列表（快速阶段 + 正常阶段）
    let deviceRefreshInterval: NodeJS.Timeout;
    let isInFastPhase = true;
    
    const startDeviceRefresh = () => {
      // 快速阶段：1 秒刷新
      deviceRefreshInterval = setInterval(() => {
        if (socketInstance.connected) {
          socketInstance.emit('get-devices');
        }
      }, 1000);
      
      // 10 秒后切换到正常阶段
      setTimeout(() => {
        if (isInFastPhase) {
          console.log('[Socket.IO] Switching to normal refresh interval (5s)');
          clearInterval(deviceRefreshInterval);
          
          // 正常阶段：5 秒刷新
          deviceRefreshInterval = setInterval(() => {
            if (socketInstance.connected) {
              socketInstance.emit('get-devices');
            }
          }, 5000);
          
          isInFastPhase = false;
        }
      }, 10000);
    };
    
    startDeviceRefresh();

    // 6. 心跳检测（可选）
    const heartbeatInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('ping', { timestamp: Date.now() });
      }
    }, 10000); // 10秒心跳

    socketInstance.on('pong', (data: { timestamp: number }) => {
      const latency = Date.now() - data.timestamp;
      console.log('[Socket.IO] Latency:', latency, 'ms');
    });

    return () => {
      clearInterval(deviceRefreshInterval);
      clearInterval(heartbeatInterval);
      socketInstance.disconnect();
    };
  }, [deviceName]); // 只依赖 deviceName

  return { socket, isConnected };
}