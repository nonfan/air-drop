/**
 * 移动端服务 Hooks
 */
import { useEffect, useState } from 'react';
import { useAppStore } from '../../core/store';
import { MobileServiceManager } from '../services/MobileServiceManager';

/**
 * 初始化服务
 */
export function useServiceInitialization(serverUrl: string) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const setConnected = useAppStore(state => state.setConnected);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const manager = MobileServiceManager.getInstance();
        await manager.initialize(serverUrl);
        
        if (mounted) {
          setIsInitialized(true);
          setConnected(true);
        }
      } catch (err) {
        if (mounted) {
          setError(err as Error);
          setConnected(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, [serverUrl, setConnected]);

  return { isInitialized, error };
}

/**
 * 文件传输
 */
export function useFileTransfer() {
  const [isSending, setIsSending] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);

  const sendFile = async (file: File, targetDeviceId: string) => {
    setIsSending(true);
    try {
      const manager = MobileServiceManager.getInstance();
      await manager.sendFile(file, targetDeviceId);
    } finally {
      setIsSending(false);
    }
  };

  const receiveFile = async (fileId: string, fileName: string) => {
    setIsReceiving(true);
    try {
      const manager = MobileServiceManager.getInstance();
      await manager.receiveFile(fileId, fileName);
    } finally {
      setIsReceiving(false);
    }
  };

  return {
    sendFile,
    receiveFile,
    isSending,
    isReceiving
  };
}

/**
 * 设备管理
 */
export function useDevices() {
  const devices = useAppStore(state => state.devices);
  const currentDevice = useAppStore(state => state.currentDevice);
  const setCurrentDevice = useAppStore(state => state.setCurrentDevice);

  return {
    devices,
    currentDevice,
    setCurrentDevice
  };
}

/**
 * 传输状态
 */
export function useTransfers() {
  const transfers = useAppStore(state => state.transfers);
  
  return {
    transfers,
    activeTransfers: transfers.filter(t => t.status === 'active'),
    completedTransfers: transfers.filter(t => t.status === 'completed'),
    failedTransfers: transfers.filter(t => t.status === 'failed')
  };
}

/**
 * 连接状态
 */
export function useConnectionStatus() {
  const isConnected = useAppStore(state => state.ui.isConnected);
  
  return { isConnected };
}
