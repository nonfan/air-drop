import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  TextModal,
  Toast,
  MobileLayout,
  DesktopLayout,
  ServerSelector
} from './components';
import { TransferPageView, HistoryPageView, SettingsPageView } from './pages';
import { AppContext } from './contexts/AppContext';
import type { Device, TransferProgress, View } from './types';
import {
  isMobileDevice,
  copyToClipboard,
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
  showSystemNotification
} from './utils';
import {
  useSocket,
  useHistory,
  useSettings,
  useFileTransfer,
  useDownload,
  useUDPDiscovery
} from './hooks';
import iconUrl from './assets/icon.png';

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  // 从路由路径获取当前视图
  const getCurrentView = (): View => {
    const path = location.pathname;
    if (path === '/history') return 'history';
    if (path === '/settings') return 'settings';
    return 'transfer';
  };

  // 基础状态
  const [view, setView] = useState<View>(getCurrentView());
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sendProgress, setSendProgress] = useState<TransferProgress | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<TransferProgress | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);
  const [copiedTextIds, setCopiedTextIds] = useState<Set<string>>(new Set());
  const [downloadProgressMap] = useState<Map<string, { percent: number; receivedSize: number; totalSize: number }>>(new Map());
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [isMobile, setIsMobile] = useState(() => isMobileDevice());

  // 使用自定义 Hooks
  const { settings, saveSettings } = useSettings();
  const { history, addHistoryItem, clearHistory } = useHistory();

  // 处理历史记录接收（不再显示弹窗提示）
  const handleHistoryItemReceived = useCallback((item: HistoryItem) => {
    addHistoryItem(item);

    // 移动端接收文件时，自动切换到历史记录页面
    if (isMobile && item.type === 'file' && item.direction === 'received') {
      // 可选：自动切换到历史记录页面
      // navigate('/history');
    }
  }, [addHistoryItem, isMobile]);

  // UDP 发现（仅在移动端且未连接时启用）
  const { servers: discoveredServers, isDiscovering, manualDiscover } = useUDPDiscovery(isMobile && devices.length === 0);

  // 处理服务器选择
  const handleSelectServer = useCallback((server: any) => {
    console.log('[UDP Discovery] 选择服务器:', server);
    // 保存服务器 URL 并重新连接
    const serverUrl = `http://${server.ip}:${server.port}`;
    setStorageItem(STORAGE_KEYS.LAST_SERVER_URL, serverUrl);
    // 刷新页面以使用新的服务器 URL
    window.location.reload();
  }, []);

  // 显示通知的回调 - 使用 useCallback 避免每次渲染创建新函数
  const showNotification = useCallback((title: string, body: string) => {
    if (settings.showNotifications) {
      showSystemNotification(title, body, iconUrl);
    }
  }, [settings.showNotifications]);

  // 设备更新回调 - 使用 useCallback 稳定引用
  const handleDevicesUpdate = useCallback((devices: Device[]) => {
    setDevices(devices);
  }, []);

  // 应用版本回调 - 使用 useCallback 稳定引用
  const handleAppVersionReceived = useCallback((version: string) => {
    setAppVersion(version);
  }, []);

  // 发送进度回调 - 使用 useCallback 稳定引用
  const handleSendProgressUpdate = useCallback((progress: { percent: number; currentFile: string; totalSize: number; sentSize: number }) => {
    setSendProgress(progress);
  }, []);

  // 下载进度回调 - 使用 useCallback 稳定引用
  const handleDownloadProgressUpdate = useCallback((progress: { percent: number; currentFile: string; totalSize: number; sentSize: number }) => {
    setDownloadProgress({
      percent: progress.percent,
      currentFile: progress.currentFile,
      totalSize: progress.totalSize,
      sentSize: progress.sentSize
    });
  }, []);

  // 发送完成回调 - 使用 useCallback 稳定引用
  const handleSendComplete = useCallback(() => {
    setSendProgress(null);
  }, []);

  // 发送错误回调 - 使用 useCallback 稳定引用
  const handleSendError = useCallback(() => {
    setSendProgress(null);
  }, []);

  // Socket.IO 连接
  const { socket } = useSocket({
    deviceName: settings.deviceName,
    onDevicesUpdate: handleDevicesUpdate,
    onHistoryItemReceived: handleHistoryItemReceived,
    onNotification: showNotification,
    onAppVersionReceived: handleAppVersionReceived,
    onSendProgressUpdate: handleSendProgressUpdate,
    onDownloadProgressUpdate: handleDownloadProgressUpdate,
    onSendComplete: handleSendComplete,
    onSendError: handleSendError
  });

  // 保存上次选择的设备
  const saveLastDevice = useCallback((deviceId: string) => {
    setStorageItem(STORAGE_KEYS.LAST_DEVICE, deviceId);
  }, []);

  // 文件传输
  const {
    selectedFiles,
    isSending,
    setSelectedFiles,
    selectFiles,
    handleDrop: handleFileDrop,
    sendFiles
  } = useFileTransfer({
    socket,
    selectedDevice,
    onSaveLastDevice: saveLastDevice,
    onProgressUpdate: handleSendProgressUpdate,
    onComplete: handleSendComplete,
    onError: handleSendError
  });

  // 文件下载
  const {
    downloadingId,
    downloadFailedId,
    downloadedIds,
    downloadFailedIds,
    downloadProgress: downloadProgressState,
    downloadFile
  } = useDownload(socket);

  // 同步路由和视图状态
  useEffect(() => {
    const newView = getCurrentView();
    if (newView !== view) {
      setView(newView);
    }
  }, [location.pathname, view]);

  // 视图切换函数
  const handleViewChange = useCallback((newView: View) => {
    setView(newView);
    const pathMap: Record<View, string> = {
      transfer: '/',
      history: '/history',
      settings: '/settings'
    };
    navigate(pathMap[newView]);
  }, [navigate]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 自动选择上次使用的设备
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      const lastDeviceId = getStorageItem<string | null>(STORAGE_KEYS.LAST_DEVICE, null);
      if (lastDeviceId) {
        const deviceExists = devices.find(d => d.id === lastDeviceId);
        if (deviceExists) {
          setSelectedDevice(lastDeviceId);
        }
      }
    }
  }, [devices, selectedDevice]);

  // 发送文本
  const handleSendText = useCallback((targetDeviceId?: string) => {
    const deviceId = targetDeviceId || selectedDevice;

    console.log('[handleSendText] Called with:', {
      targetDeviceId,
      selectedDevice,
      deviceId,
      text: text.trim(),
      textLength: text.trim().length,
      socketConnected: socket?.connected,
      hasSocket: !!socket
    });

    if (!socket || !deviceId || !text.trim()) {
      console.log('[handleSendText] Early return:', {
        hasSocket: !!socket,
        hasDeviceId: !!deviceId,
        hasText: !!text.trim()
      });
      return;
    }

    if (!socket.connected) {
      console.error('[handleSendText] Socket.IO not connected');
      return;
    }

    try {
      socket.emit('send-text', {
        text: text.trim(),
        targetId: deviceId
      });

      console.log('[handleSendText] Text sent successfully to device:', deviceId);
      saveLastDevice(deviceId);
      setText('');
    } catch (error) {
      console.error('[handleSendText] Send text error:', error);
    }
  }, [socket, selectedDevice, text, saveLastDevice]);

  // 统一的发送函数
  const handleSend = useCallback((targetDeviceId?: string) => {
    console.log('[handleSend] Called with:', {
      targetDeviceId,
      selectedFilesCount: selectedFiles.length,
      textLength: text.trim().length,
      hasFiles: selectedFiles.length > 0,
      hasText: !!text.trim()
    });

    // 根据实际内容判断发送类型，而不是依赖 mode
    if (selectedFiles.length > 0) {
      console.log('[handleSend] Sending files');
      sendFiles(targetDeviceId);
    } else if (text.trim()) {
      console.log('[handleSend] Sending text');
      handleSendText(targetDeviceId);
    } else {
      console.log('[handleSend] No content to send');
    }
  }, [selectedFiles.length, text, sendFiles, handleSendText]);

  // 复制文本
  const handleCopyText = useCallback(async (content: string, id: string) => {
    setCopyFailedId(null);

    const success = await copyToClipboard(content);
    if (success) {
      setCopiedId(id);
      setCopiedTextIds(prev => new Set(prev).add(id));
      setTimeout(() => setCopiedId(null), 2000);
    } else {
      setCopyFailedId(id);
      setTimeout(() => setCopyFailedId(null), 3000);
    }
  }, []);

  // 处理拖放
  const handleDrop = useCallback((e: React.DragEvent) => {
    handleFileDrop(e);
    setIsDragging(false);
    setMode('file');
  }, [handleFileDrop]);

  // Context 值
  const contextValue = {
    mode,
    devices,
    selectedDevice,
    selectedFiles,
    text,
    history,
    settings,
    isSending,
    sendProgress,
    downloadProgress,
    isDragging,
    copiedId,
    copyFailedId,
    copiedTextIds,
    downloadingId,
    downloadFailedId,
    downloadedIds,
    downloadFailedIds,
    downloadProgressMap,
    downloadProgressState, // 新增：下载进度状态
    showAllHistory,
    appVersion,
    isMobile,
    setMode,
    onSelectDevice: setSelectedDevice,
    onFilesChange: setSelectedFiles,
    onSelectFiles: selectFiles,
    onTextChange: setText,
    onSend: handleSend,
    onCopyText: handleCopyText,
    onDownloadFile: downloadFile,
    onClearHistory: clearHistory,
    onToggleShowAll: () => setShowAllHistory(!showAllHistory),
    onSaveSettings: saveSettings,
    onShowTextModal: () => setShowTextModal(true)
  };

  return (
    <AppContext.Provider value={contextValue}>
      {isMobile ? (
        <MobileLayout
          view={view}
          deviceName={settings.deviceName}
          historyCount={history.length}
          onViewChange={handleViewChange}
          onClearHistory={clearHistory}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Routes>
            <Route path="/" element={<TransferPageView />} />
            <Route path="/history" element={<HistoryPageView />} />
            <Route path="/settings" element={<SettingsPageView />} />
          </Routes>
        </MobileLayout>
      ) : (
        <DesktopLayout
          view={view}
          deviceName={settings.deviceName}
          appVersion={appVersion}
          onViewChange={handleViewChange}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Routes>
            <Route path="/" element={<TransferPageView />} />
            <Route path="/history" element={<HistoryPageView />} />
            <Route path="/settings" element={<SettingsPageView />} />
          </Routes>
        </DesktopLayout>
      )}

      {isMobile && (
        <TextModal
          isOpen={showTextModal}
          text={text}
          onTextChange={setText}
          onClose={() => {
            setShowTextModal(false);
            setText(''); // 取消时清空文本
          }}
          onConfirm={() => {
            setShowTextModal(false); // 确认后关闭弹窗，文本保留，等待用户选择设备发送
          }}
          disabled={false}
        />
      )}

      {isMobile && discoveredServers.length > 0 && (
        <ServerSelector
          servers={discoveredServers}
          isDiscovering={isDiscovering}
          onSelectServer={handleSelectServer}
          onRefresh={manualDiscover}
        />
      )}

      <Toast message={null} />
    </AppContext.Provider>
  );
}
