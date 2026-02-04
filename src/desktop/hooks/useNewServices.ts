/**
 * React Hook - 在渲染进程中使用新服务
 */
import { useEffect } from 'react';
import { useAppStore } from '../../core/store';

/**
 * 使用设备管理
 */
export function useDevices() {
  const devices = useAppStore(state => state.devices);
  const currentDevice = useAppStore(state => state.currentDevice);
  const addDevice = useAppStore(state => state.addDevice);
  const removeDevice = useAppStore(state => state.removeDevice);
  const setCurrentDevice = useAppStore(state => state.setCurrentDevice);

  useEffect(() => {
    // 监听设备发现事件
    const handleDeviceFound = (_event: any, device: any) => {
      addDevice(device);
    };

    const handleDeviceLost = (_event: any, deviceId: string) => {
      removeDevice(deviceId);
    };

    window.electron?.ipcRenderer.on('device-found', handleDeviceFound);
    window.electron?.ipcRenderer.on('device-lost', handleDeviceLost);

    return () => {
      window.electron?.ipcRenderer.removeListener('device-found', handleDeviceFound);
      window.electron?.ipcRenderer.removeListener('device-lost', handleDeviceLost);
    };
  }, [addDevice, removeDevice]);

  return {
    devices,
    currentDevice,
    setCurrentDevice
  };
}

/**
 * 使用传输管理
 */
export function useTransfers() {
  const transfers = useAppStore(state => state.transfers);
  const addTransfer = useAppStore(state => state.addTransfer);
  const updateTransfer = useAppStore(state => state.updateTransfer);
  const removeTransfer = useAppStore(state => state.removeTransfer);

  useEffect(() => {
    // 监听传输事件
    const handleTransferCreated = (_event: any, transfer: any) => {
      addTransfer(transfer);
    };

    const handleTransferProgress = (_event: any, progress: any) => {
      updateTransfer(progress.transferId, {
        progress: progress.percent,
        speed: progress.speed
      });
    };

    const handleTransferCompleted = (_event: any, transfer: any) => {
      updateTransfer(transfer.id, {
        status: 'completed',
        progress: 100
      });
    };

    const handleTransferFailed = (_event: any, transfer: any) => {
      updateTransfer(transfer.id, {
        status: 'failed',
        error: transfer.error
      });
    };

    window.electron?.ipcRenderer.on('transfer-created', handleTransferCreated);
    window.electron?.ipcRenderer.on('transfer-progress', handleTransferProgress);
    window.electron?.ipcRenderer.on('transfer-completed', handleTransferCompleted);
    window.electron?.ipcRenderer.on('transfer-failed', handleTransferFailed);

    return () => {
      window.electron?.ipcRenderer.removeAllListeners('transfer-created');
      window.electron?.ipcRenderer.removeAllListeners('transfer-progress');
      window.electron?.ipcRenderer.removeAllListeners('transfer-completed');
      window.electron?.ipcRenderer.removeAllListeners('transfer-failed');
    };
  }, [addTransfer, updateTransfer]);

  return {
    transfers,
    activeTransfers: transfers.filter(t => t.status === 'active'),
    completedTransfers: transfers.filter(t => t.status === 'completed')
  };
}

/**
 * 使用设置管理
 */
export function useSettings() {
  const settings = useAppStore(state => state.settings);
  const updateSettings = useAppStore(state => state.updateSettings);

  return {
    settings,
    updateSettings
  };
}

/**
 * 使用历史记录
 */
export function useHistory() {
  const history = useAppStore(state => state.history);
  const addHistoryItem = useAppStore(state => state.addHistoryItem);
  const clearHistory = useAppStore(state => state.clearHistory);

  return {
    history,
    addHistoryItem,
    clearHistory
  };
}
