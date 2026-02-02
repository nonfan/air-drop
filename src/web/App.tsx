import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  TextModal,
  Toast,
  MobileLayout,
  DesktopLayout
} from './components';
import { TransferPageView, HistoryPageView, SettingsPageView } from './pages';
import { AppContext } from './contexts/AppContext';
import type { Device, FileItem, TransferProgress, HistoryItem, Settings, View } from './types';
import iconUrl from './assets/icon.png';
import { io, Socket } from 'socket.io-client';

// 从 User Agent 中提取设备型号
function getDeviceModel(): string {
  const ua = navigator.userAgent;

  // iPhone 检测
  if (/iPhone/.test(ua)) {
    // 尝试提取 iPhone 型号
    const match = ua.match(/iPhone\s?(\d+[,_]\d+)?/);
    if (match) {
      // iPhone 型号映射
      const modelMap: { [key: string]: string } = {
        'iPhone15,2': 'iPhone 14 Pro',
        'iPhone15,3': 'iPhone 14 Pro Max',
        'iPhone14,7': 'iPhone 14',
        'iPhone14,8': 'iPhone 14 Plus',
        'iPhone14,4': 'iPhone 13 mini',
        'iPhone14,5': 'iPhone 13',
        'iPhone14,2': 'iPhone 13 Pro',
        'iPhone14,3': 'iPhone 13 Pro Max',
        'iPhone13,1': 'iPhone 12 mini',
        'iPhone13,2': 'iPhone 12',
        'iPhone13,3': 'iPhone 12 Pro',
        'iPhone13,4': 'iPhone 12 Pro Max',
      };

      const model = match[1]?.replace('_', ',');
      if (model && modelMap[`iPhone${model}`]) {
        return modelMap[`iPhone${model}`];
      }
    }
    return 'iPhone';
  }

  // iPad 检测
  if (/iPad/.test(ua)) {
    if (/iPad.*Pro/.test(ua)) {
      return 'iPad Pro';
    }
    if (/iPad.*Air/.test(ua)) {
      return 'iPad Air';
    }
    if (/iPad.*Mini/.test(ua)) {
      return 'iPad Mini';
    }
    return 'iPad';
  }

  // Android 检测
  if (/Android/.test(ua)) {
    // 尝试提取品牌和型号
    const brands = [
      { pattern: /Xiaomi|MI|Redmi/i, name: '小米' },
      { pattern: /HUAWEI|Honor/i, name: '华为' },
      { pattern: /OPPO/i, name: 'OPPO' },
      { pattern: /vivo/i, name: 'vivo' },
      { pattern: /OnePlus/i, name: '一加' },
      { pattern: /Samsung|SM-/i, name: '三星' },
      { pattern: /Pixel/i, name: 'Google Pixel' },
    ];

    for (const brand of brands) {
      if (brand.pattern.test(ua)) {
        // 尝试提取具体型号
        const modelMatch = ua.match(/\(([^)]+)\)/);
        if (modelMatch) {
          const parts = modelMatch[1].split(';');
          for (const part of parts) {
            const trimmed = part.trim();
            if (brand.pattern.test(trimmed)) {
              return trimmed;
            }
          }
        }
        return brand.name;
      }
    }
    return 'Android 设备';
  }

  // 桌面浏览器检测
  if (/Macintosh|Mac OS X/.test(ua)) {
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
      return 'Mac Safari';
    }
    if (/Chrome/.test(ua)) {
      return 'Mac Chrome';
    }
    if (/Firefox/.test(ua)) {
      return 'Mac Firefox';
    }
    return 'Mac';
  }

  if (/Windows/.test(ua)) {
    if (/Edge/.test(ua)) {
      return 'Windows Edge';
    }
    if (/Chrome/.test(ua)) {
      return 'Windows Chrome';
    }
    if (/Firefox/.test(ua)) {
      return 'Windows Firefox';
    }
    return 'Windows PC';
  }

  if (/Linux/.test(ua)) {
    return 'Linux';
  }

  return '未知设备';
}

// 生成设备名称（基于真实设备型号）
function generateDeviceName(): string {
  const deviceModel = getDeviceModel();
  const randomNum = Math.floor(Math.random() * 1000);

  // 如果是移动设备，添加随机数以区分同型号设备
  if (/iPhone|iPad|Android|小米|华为|OPPO|vivo|一加|三星|Pixel/.test(deviceModel)) {
    return `${deviceModel}-${randomNum}`;
  }

  // 桌面设备直接使用型号
  return deviceModel;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
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

  const [view, setView] = useState<View>(getCurrentView());
  const [mode, setMode] = useState<'file' | 'text'>('file');
  const [devices, setDevices] = useState<Device[]>([
    {
      id: 'placeholder-1',
      name: '我的 MacBook Pro',
      model: 'macOS 14.0',
      ip: '192.168.1.100',
      type: 'pc'
    },
    {
      id: 'placeholder-2',
      name: 'iPhone 15 Pro',
      model: 'iOS 17.0',
      ip: '192.168.1.101',
      type: 'mobile'
    },
    {
      id: 'placeholder-3',
      name: 'Windows 台式机',
      model: 'Windows 11',
      ip: '192.168.1.102',
      type: 'pc'
    }
  ]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [text, setText] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([
    {
      id: 'history-1',
      type: 'file',
      fileName: '项目文档.pdf',
      fileSize: 2048576,
      filePath: '/downloads/项目文档.pdf',
      timestamp: Date.now() - 300000,
      status: 'success',
      direction: 'received',
      from: '我的 MacBook Pro'
    },
    {
      id: 'history-2',
      type: 'text',
      content: '这是一段测试文本消息，用于预览UI效果',
      timestamp: Date.now() - 600000,
      status: 'success',
      direction: 'received',
      from: 'iPhone 15 Pro'
    },
    {
      id: 'history-3',
      type: 'file',
      fileName: '照片_2024.jpg',
      fileSize: 5242880,
      filePath: '/downloads/照片_2024.jpg',
      timestamp: Date.now() - 900000,
      status: 'success',
      direction: 'received',
      from: 'Windows 台式机'
    }
  ]);
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
      showNotifications: false,
      discoverable: true,
      accentColor: 'blue'
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

  const [showTextModal, setShowTextModal] = useState(false);

  // 检测是否为移动设备
  const [isMobile, setIsMobile] = useState(() => {
    return window.innerWidth < 768 || /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  });

  // 同步路由和视图状态
  useEffect(() => {
    const newView = getCurrentView();
    if (newView !== view) {
      setView(newView);
    }
  }, [location.pathname]);

  // 视图切换函数 - 使用路由导航
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
      setIsMobile(window.innerWidth < 768 || /Mobile|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
        // 只有当 localStorage 中有数据时才覆盖测试数据
        if (parsed && parsed.length > 0) {
          setHistory(parsed);
        }
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

  // 应用主题色
  useEffect(() => {
    const accentColorMap: Record<string, string> = {
      blue: '#3b82f6',
      green: '#22c55e',
      purple: '#a855f7',
      pink: '#ec4899',
      orange: '#f97316'
    };

    const color = accentColorMap[settings.accentColor] || accentColorMap.blue;
    document.documentElement.style.setProperty('--accent', color);

    // 计算 hover 颜色（稍微深一点）
    const hoverColorMap: Record<string, string> = {
      blue: '#2563eb',
      green: '#16a34a',
      purple: '#9333ea',
      pink: '#db2777',
      orange: '#ea580c'
    };
    const hoverColor = hoverColorMap[settings.accentColor] || hoverColorMap.blue;
    document.documentElement.style.setProperty('--accent-hover', hoverColor);

    // 计算背景颜色（15% 透明度）
    const accentBgMap: Record<string, string> = {
      blue: 'rgba(59, 130, 246, 0.15)',
      green: 'rgba(34, 197, 94, 0.15)',
      purple: 'rgba(168, 85, 247, 0.15)',
      pink: 'rgba(236, 72, 153, 0.15)',
      orange: 'rgba(249, 115, 22, 0.15)'
    };
    const accentBg = accentBgMap[settings.accentColor] || accentBgMap.blue;
    document.documentElement.style.setProperty('--accent-bg', accentBg);
  }, [settings.accentColor]);

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

    // 尝试从 localStorage 获取上次连接的地址
    const lastConnectedUrl = localStorage.getItem('windrop-last-server-url');

    let socketUrl: string;

    if (lastConnectedUrl && !isDev) {
      // 如果有上次连接的地址，优先使用
      socketUrl = lastConnectedUrl;
      console.log('[Socket.IO] Using last connected URL:', socketUrl);
    } else {
      // 否则使用默认地址
      socketUrl = isDev
        ? 'http://localhost:8080'  // 开发模式：连接到 Electron 的 webServer
        : window.location.origin;   // 生产模式：连接到当前页面的服务器
    }

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
      // 主动请求设备列表
      socketInstance.emit('get-devices');
    });

    socketInstance.on('connected', (data: { clientId: string; deviceName: string; appVersion: string }) => {
      console.log('Connected to server:', data);
      if (data.appVersion) {
        setAppVersion(data.appVersion);
      }

      // 保存成功连接的服务器地址
      if (!import.meta.env.DEV) {
        localStorage.setItem('windrop-last-server-url', socketUrl);
        console.log('[Socket.IO] Saved server URL for future connections');
      }

      // 连接成功后再次请求设备列表，确保获取到最新的设备信息
      socketInstance.emit('get-devices');
    });

    socketInstance.on('devices-updated', (data: { devices: Device[] }) => {
      console.log('[Socket.IO] Received devices-updated:', data.devices);
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
      // 重新连接后请求设备列表
      socketInstance.emit('get-devices');
    });

    setSocket(socketInstance);

    // 定期刷新设备列表（每10秒）
    const deviceRefreshInterval = setInterval(() => {
      if (socketInstance.connected) {
        socketInstance.emit('get-devices');
      }
    }, 10000);

    return () => {
      clearInterval(deviceRefreshInterval);
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
  const handleSendFiles = useCallback(async (targetDeviceId?: string) => {
    // 使用传入的 deviceId 或当前选中的设备
    const deviceId = targetDeviceId || selectedDevice;
    if (!socket || !deviceId || selectedFiles.length === 0) return;

    if (!socket.connected) {
      console.error('Socket.IO not connected');
      return;
    }

    setIsSending(true);

    try {
      for (const fileItem of selectedFiles) {
        const formData = new FormData();
        formData.append('file', fileItem.file);
        formData.append('targetId', deviceId);
        formData.append('fileName', fileItem.name);

        // 使用完整 URL 确保端口正确
        const uploadUrl = `${window.location.origin}/api/upload`;
        console.log('Uploading to:', uploadUrl, 'targetId:', deviceId);

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
      saveLastDevice(deviceId);

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
  const handleSendText = useCallback((targetDeviceId?: string) => {
    // 使用传入的 deviceId 或当前选中的设备
    const deviceId = targetDeviceId || selectedDevice;
    if (!socket || !deviceId || !text.trim()) return;

    if (!socket.connected) {
      console.error('Socket.IO not connected');
      return;
    }

    try {
      socket.emit('send-text', {
        text: text.trim(),
        targetId: deviceId
      });

      console.log('Sent text to device:', deviceId);

      // 保存上次选择的设备
      saveLastDevice(deviceId);

      setText('');
    } catch (error) {
      console.error('Send text error:', error);
    }
  }, [socket, selectedDevice, text, saveLastDevice]);

  // 统一的发送函数
  const handleSend = useCallback((targetDeviceId?: string) => {
    if (mode === 'file') {
      handleSendFiles(targetDeviceId);
    } else {
      handleSendText(targetDeviceId);
    }
  }, [mode, handleSendFiles, handleSendText]);
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
    showAllHistory,
    appVersion,
    isMobile,
    setMode,
    onSelectDevice: setSelectedDevice,
    onFilesChange: setSelectedFiles,
    onSelectFiles: handleSelectFiles,
    onTextChange: setText,
    onSend: handleSend,
    onCopyText: handleCopyText,
    onDownloadFile: handleDownloadFile,
    onClearHistory: handleClearHistory,
    onToggleShowAll: () => setShowAllHistory(!showAllHistory),
    onSaveSettings: saveSettings,
    onShowTextModal: () => setShowTextModal(true)
  };

  return (
    <AppContext.Provider value={contextValue}>
      {isMobile ? (
        // 移动端布局
        <MobileLayout
          view={view}
          deviceName={settings.deviceName}
          historyCount={history.length}
          onViewChange={handleViewChange}
          onClearHistory={handleClearHistory}
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
        // 桌面端布局
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

      {/* 文本输入弹窗 - 仅移动端 */}
      {isMobile && (
        <TextModal
          isOpen={showTextModal}
          text={text}
          onTextChange={setText}
          onClose={() => setShowTextModal(false)}
          onSend={handleSend}
          disabled={!text.trim() || !selectedDevice}
        />
      )}

      {/* Toast 通知 */}
      <Toast message={toast} />
    </AppContext.Provider>
  );
}
