import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { TransferPage } from './components/TransferPage';
import { SettingsPage } from './components/SettingsPage';
import type { Device, FileItem, TransferProgress, HistoryItem, Settings, View } from './types';
import iconUrl from './assets/icon.png';
import { io, Socket } from 'socket.io-client';

// 生成随机设备名称
function generateDeviceName(): string {
  const isMobile = navigator.userAgent.includes('Mobile');
  const adjectives = ['快乐的', '勇敢的', '聪明的', '可爱的', '神秘的', '闪亮的'];
  const animals = ['熊猫', '狐狸', '企鹅', '海豚', '猫咪', '兔子'];
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
  const randomNum = Math.floor(Math.random() * 1000);

  if (isMobile) {
    return `iPhone-${randomAdj}${randomAnimal}${randomNum}`;
  } else {
    return `浏览器-${randomAdj}${randomAnimal}${randomNum}`;
  }
}

export default function App() {
  const [view, setView] = useState<View>('transfer');
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [text, setText] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [settings, setSettings] = useState<Settings>(() => {
    // 从 localStorage 读取或生成新的设备名称
    const saved = localStorage.getItem('windrop-settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
    return {
      deviceName: generateDeviceName(),
      theme: 'dark',
      showNotifications: false
    };
  });
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<TransferProgress | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<TransferProgress | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadFailedId, setDownloadFailedId] = useState<string | null>(null);
  const [copyFailedId, setCopyFailedId] = useState<string | null>(null);
  const [copiedTextIds, setCopiedTextIds] = useState<Set<string>>(new Set()); // 已复制过的文本ID，不显示"待复制"
  const [downloadProgressMap, setDownloadProgressMap] = useState<Map<string, { percent: number; receivedSize: number; totalSize: number }>>(new Map()); // 每个文件的下载进度
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(() => {
    // 从 localStorage 加载已下载的文件 ID
    const saved = localStorage.getItem('windrop-downloaded-ids');
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch (e) {
        return new Set();
      }
    }
    return new Set();
  });
  const [downloadFailedIds, setDownloadFailedIds] = useState<Set<string>>(() => {
    // 从 localStorage 加载下载失败的文件 ID
    const saved = localStorage.getItem('windrop-download-failed-ids');
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch (e) {
        return new Set();
      }
    }
    return new Set();
  });
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [showAllHistory, setShowAllHistory] = useState(false);

  // 保存上次选择的设备ID
  const saveLastDevice = useCallback((deviceId: string) => {
    localStorage.setItem('windrop-last-device', deviceId);
  }, []);

  // 自动选择上次使用的设备（如果在线）
  useEffect(() => {
    if (devices.length > 0 && !selectedDevice) {
      const lastDeviceId = localStorage.getItem('windrop-last-device');
      if (lastDeviceId) {
        const deviceExists = devices.find(d => d.id === lastDeviceId);
        if (deviceExists) {
          setSelectedDevice(lastDeviceId);
        }
      }
    }
  }, [devices, selectedDevice]);

  // 加载本地设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('windrop-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }

    const savedHistory = localStorage.getItem('windrop-history');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(parsed);
      } catch (e) {
        console.error('Failed to parse history:', e);
      }
    }
  }, []);

  // 保存设置到 localStorage
  const saveSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('windrop-settings', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // 保存历史记录
  const saveHistory = useCallback((newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem('windrop-history', JSON.stringify(newHistory));
  }, []);

  // 应用主题
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
      root.classList.toggle('light', !prefersDark);
    } else {
      root.classList.remove('dark', 'light');
      root.classList.add(settings.theme);
    }
  }, [settings.theme]);

  // 请求通知权限
  useEffect(() => {
    if (settings.showNotifications && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [settings.showNotifications]);

  // 显示通知
  const showNotification = useCallback((title: string, body: string) => {
    if (settings.showNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, icon: iconUrl });
    }
  }, [settings.showNotifications]);

  // Socket.IO 连接
  useEffect(() => {
    // 在开发模式下，Socket.IO 服务器运行在不同的端口
    const isDev = import.meta.env.DEV;
    const socketUrl = isDev
      ? 'http://localhost:8080'  // 开发模式：连接到 Electron 的 webServer
      : window.location.origin;   // 生产模式：连接到当前页面的服务器

    console.log('[Socket.IO] Connecting to:', socketUrl);

    const socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: Infinity
    });

    socketInstance.on('connect', () => {
      console.log('Socket.IO connected');
      socketInstance.emit('set-name', {
        name: settings.deviceName,
        model: navigator.userAgent
      });
    });

    socketInstance.on('connected', (data: { clientId: string; deviceName: string; appVersion: string }) => {
      console.log('Connected to server:', data);
      if (data.appVersion) {
        setAppVersion(data.appVersion);
      }
    });

    socketInstance.on('devices-updated', (data: { devices: Device[] }) => {
      setDevices(data.devices);
    });

    socketInstance.on('files-updated', (data: { files: any[]; texts: any[] }) => {
      // 处理共享的文本和文件
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
          setHistory(prev => {
            if (prev.find(h => h.id === item.id)) return prev;
            const newHistory = [item, ...prev];
            localStorage.setItem('windrop-history', JSON.stringify(newHistory));
            return newHistory;
          });
        });
        if (data.texts.length > 0) {
          showNotification('收到文本消息', `来自桌面端`);
        }
      }
    });

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
      setHistory(prev => {
        const newHistory = [item, ...prev];
        localStorage.setItem('windrop-history', JSON.stringify(newHistory));
        return newHistory;
      });
      showNotification('收到文本消息', `来自 ${data.from}`);
    });

    socketInstance.on('text-received', (data?: { id?: string; text?: string; from?: string }) => {
      if (data && data.text) {
        // 处理来自桌面端的文本消息
        const item: HistoryItem = {
          id: data.id || Date.now().toString(),
          type: 'text',
          content: data.text,
          timestamp: Date.now(),
          status: 'success',
          direction: 'received',
          from: data.from || '桌面端'
        };
        setHistory(prev => {
          if (prev.find(h => h.id === item.id)) return prev;
          const newHistory = [item, ...prev];
          localStorage.setItem('windrop-history', JSON.stringify(newHistory));
          return newHistory;
        });
        showNotification('收到文本消息', `来自 ${data.from}`);
      }
      // 文本发送成功确认（没有 text 字段）- 静默处理
    });

    socketInstance.on('file-received', (data: { fileName: string; fileSize: number; filePath: string; from: string }) => {
      console.log('[Socket.IO] Received file-received message:', data);
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
      console.log('[Socket.IO] Adding file to history:', item);
      setHistory(prev => {
        const newHistory = [item, ...prev];
        localStorage.setItem('windrop-history', JSON.stringify(newHistory));
        console.log('[Socket.IO] History updated, new length:', newHistory.length);
        return newHistory;
      });
      showNotification('收到文件', `${data.fileName} 来自 ${data.from}`);
      setDownloadProgress(null);
    });

    socketInstance.on('download-progress', (data: { percent: number; fileName: string; totalSize: number; receivedSize: number }) => {
      setDownloadProgress({
        percent: data.percent,
        currentFile: data.fileName,
        totalSize: data.totalSize,
        sentSize: data.receivedSize
      });
    });

    socketInstance.on('upload-progress', (data: { percent: number; fileName: string; totalSize: number; sentSize: number }) => {
      setSendProgress({
        percent: data.percent,
        currentFile: data.fileName,
        totalSize: data.totalSize,
        sentSize: data.sentSize
      });
    });

    socketInstance.on('upload-complete', () => {
      setIsSending(false);
      setSendProgress(null);
    });

    socketInstance.on('upload-error', () => {
      setIsSending(false);
      setSendProgress(null);
    });

    socketInstance.on('error', (error: any) => {
      console.error('Socket.IO error:', error);
    });

    socketInstance.on('disconnect', (reason: string) => {
      console.log('Socket.IO disconnected:', reason);
    });

    socketInstance.on('reconnect', (attemptNumber: number) => {
      console.log('Socket.IO reconnected after', attemptNumber, 'attempts');
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [settings.deviceName, showNotification]);

  // 处理文件拖放
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).map(file => ({
      name: file.name,
      size: file.size,
      file
    }));
    if (droppedFiles.length) {
      setSelectedFiles(prev => [...prev, ...droppedFiles]);
      setMode('file');
    }
  }, []);

  // 选择文件
  const handleSelectFiles = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        const newFiles = Array.from(target.files).map(file => ({
          name: file.name,
          size: file.size,
          file
        }));
        setSelectedFiles(prev => [...prev, ...newFiles]);
      }
    };
    input.click();
  }, []);

  // 发送文件
  const handleSendFiles = useCallback(async () => {
    if (!socket || !selectedDevice || selectedFiles.length === 0) return;

    if (!socket.connected) {
      console.error('Socket.IO not connected');
      return;
    }

    setIsSending(true);

    try {
      for (const fileItem of selectedFiles) {
        const formData = new FormData();
        formData.append('file', fileItem.file);
        formData.append('targetId', selectedDevice);
        formData.append('fileName', fileItem.name);

        // 使用完整 URL 确保端口正确
        const uploadUrl = `${window.location.origin}/api/upload`;
        console.log('Uploading to:', uploadUrl);

        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Upload failed:', response.status, errorText);
          throw new Error('Upload failed');
        }
      }

      // 保存上次选择的设备
      saveLastDevice(selectedDevice);

      setSelectedFiles([]);
      setIsSending(false);
      setSendProgress(null);
      // 不显示 toast，静默处理
    } catch (error) {
      console.error('Send error:', error);
      setIsSending(false);
      setSendProgress(null);
      // 不显示 toast，静默处理
    }
  }, [socket, selectedDevice, selectedFiles, saveLastDevice]);

  // 发送文本
  const handleSendText = useCallback(() => {
    if (!socket || !selectedDevice || !text.trim()) return;

    if (!socket.connected) {
      console.error('Socket.IO not connected');
      return;
    }

    try {
      socket.emit('send-text', {
        text: text.trim(),
        targetId: selectedDevice
      });

      // 保存上次选择的设备
      saveLastDevice(selectedDevice);

      setText('');
    } catch (error) {
      console.error('Send text error:', error);
    }
  }, [socket, selectedDevice, text, saveLastDevice]);

  // 复制文本
  const handleCopyText = useCallback(async (content: string, id: string) => {
    // 清除之前的状态
    setCopyFailedId(null);

    try {
      // 优先使用 Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
        setCopiedId(id);
        // 标记为已复制过
        setCopiedTextIds(prev => new Set(prev).add(id));
        setTimeout(() => setCopiedId(null), 2000);
      } else {
        // 降级方案：使用传统的 execCommand
        const textArea = document.createElement('textarea');
        textArea.value = content;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
          const successful = document.execCommand('copy');
          if (successful) {
            setCopiedId(id);
            // 标记为已复制过
            setCopiedTextIds(prev => new Set(prev).add(id));
            setTimeout(() => setCopiedId(null), 2000);
          } else {
            throw new Error('execCommand failed');
          }
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (error) {
      console.error('Copy failed:', error);
      setCopyFailedId(id);
      setTimeout(() => setCopyFailedId(null), 3000);
    }
  }, []);

  // 清空历史记录
  const handleClearHistory = useCallback(() => {
    saveHistory([]);
    // 不显示 toast，静默处理
  }, [saveHistory]);

  // 下载文件
  const handleDownloadFile = useCallback(async (filePath: string, fileName: string, itemId: string) => {
    // 如果已经下载过，不再下载
    if (downloadedIds.has(itemId)) {
      return;
    }

    // 清除当前项的失败状态（如果是重试）
    if (downloadFailedIds.has(itemId)) {
      const newFailedIds = new Set(downloadFailedIds);
      newFailedIds.delete(itemId);
      setDownloadFailedIds(newFailedIds);
      localStorage.setItem('windrop-download-failed-ids', JSON.stringify(Array.from(newFailedIds)));
    }

    // 只清除当前项的临时失败状态
    if (downloadFailedId === itemId) {
      setDownloadFailedId(null);
    }

    setDownloadingId(itemId);

    try {
      console.log('[Download] Starting download:', fileName, filePath);

      // 构建完整的下载 URL
      let downloadUrl = filePath;
      if (filePath.startsWith('/')) {
        // 在生产模式下，window.location.origin 就是 PC 的地址（如 http://192.168.1.5:8080）
        // 在开发模式下，使用 localhost:8080
        const isDev = import.meta.env?.DEV;
        const serverUrl = isDev ? 'http://localhost:8080' : window.location.origin;
        downloadUrl = `${serverUrl}${filePath}`;
      }

      console.log('[Download] Download URL:', downloadUrl);

      // 对于大文件，直接使用浏览器原生下载，避免内存溢出
      // 创建隐藏的 <a> 标签并触发下载
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // 清理
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);

      console.log('[Download] Download triggered successfully');

      setDownloadingId(null);

      // 标记为已下载并保存到 localStorage
      const newDownloadedIds = new Set(downloadedIds).add(itemId);
      setDownloadedIds(newDownloadedIds);
      localStorage.setItem('windrop-downloaded-ids', JSON.stringify(Array.from(newDownloadedIds)));

    } catch (error) {
      console.error('[Download] Download error:', error);
      setDownloadingId(null);
      setDownloadFailedId(itemId);
      // 标记为下载失败并保存到 localStorage（常驻）
      const newFailedIds = new Set(downloadFailedIds).add(itemId);
      setDownloadFailedIds(newFailedIds);
      localStorage.setItem('windrop-download-failed-ids', JSON.stringify(Array.from(newFailedIds)));

      // 通知服务器下载失败
      if (socket && socket.connected) {
        socket.emit('download-failed', {
          fileName,
          filePath
        });
      }
    }
  }, [downloadedIds, downloadFailedIds, downloadFailedId, socket]);

  return (
    <div
      className="flex h-screen bg-background text-foreground"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* 左侧边栏 */}
      <Sidebar view={view} onViewChange={setView} />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 顶部标题栏 - 固定 */}
        <div className="flex-shrink-0">
          <Header view={view} onViewChange={setView} />
        </div>

        {/* 内容区域 - 可滚动 */}
        <div className="flex-1 overflow-hidden">
          {view === 'settings' ? (
            <div className="h-full overflow-y-auto">
              <SettingsPage settings={settings} onSaveSettings={saveSettings} />
            </div>
          ) : (
            <TransferPage
              mode={mode}
              onModeChange={setMode}
              devices={devices}
              selectedDevice={selectedDevice}
              onSelectDevice={setSelectedDevice}
              selectedFiles={selectedFiles}
              onFilesChange={setSelectedFiles}
              onSelectFiles={handleSelectFiles}
              text={text}
              onTextChange={setText}
              isDragging={isDragging}
              isSending={isSending}
              sendProgress={sendProgress}
              downloadProgress={downloadProgress}
              onSend={mode === 'file' ? handleSendFiles : handleSendText}
              history={history}
              showAllHistory={showAllHistory}
              onToggleShowAll={() => setShowAllHistory(!showAllHistory)}
              onClearHistory={handleClearHistory}
              copiedId={copiedId}
              copyFailedId={copyFailedId}
              copiedTextIds={copiedTextIds}
              downloadingId={downloadingId}
              downloadFailedId={downloadFailedId}
              downloadedIds={downloadedIds}
              downloadFailedIds={downloadFailedIds}
              downloadProgressMap={downloadProgressMap}
              onCopyText={handleCopyText}
              onDownloadFile={handleDownloadFile}
            />
          )}
        </div>

        {/* Footer - 横跨整个底部 */}
        {view === 'transfer' && (
          <div className="flex-shrink-0 px-6 py-3 border-t border-border bg-secondary/50 hidden min-[1024px]:block">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{settings.deviceName}</span>
              <span>v{appVersion}</span>
            </div>
          </div>
        )}
      </div>

      {/* Toast 通知 - 仅用于极少数情况 */}
      {toast && (
        <div className="toast fade-in">
          <p className="text-sm font-medium">{toast}</p>
        </div>
      )}
    </div>
  );
}
