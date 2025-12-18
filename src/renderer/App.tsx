/// <reference path="./types.d.ts" />
import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface Device { id: string; name: string; ip: string; port?: number; type: 'pc' | 'mobile'; }
interface FileTransferInfo { transferId: string; senderName: string; files: { name: string; size: number }[]; totalSize: number; }
interface Settings { deviceName: string; downloadPath: string; autoAccept: boolean; showNotifications: boolean; }
interface TransferProgress { percent: number; currentFile: string; }
interface TransferRecord { id: string; fileName: string; filePath: string; size: number; from: string; timestamp: number; type: 'received' | 'sent'; }
interface FileItem { name: string; size: number; path: string; }
interface SharedFile { id: string; name: string; size: number; path: string; targetId: string; }
interface SharedText { id: string; text: string; targetId: string; }
interface ReceivedText { id: string; text: string; from: string; timestamp: number; }

type View = 'transfer' | 'settings';

function App() {
  const [view, setView] = useState<View>('transfer');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [incomingTransfer, setIncomingTransfer] = useState<FileTransferInfo | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sendProgress, setSendProgress] = useState<TransferProgress | null>(null);
  const [webURL, setWebURL] = useState('');
  const [webUploadProgress, setWebUploadProgress] = useState<{ name: string; percent: number } | null>(null);
  const [receiveProgress, setReceiveProgress] = useState<TransferProgress | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [sharedTexts, setSharedTexts] = useState<SharedText[]>([]);
  const [receivedTexts, setReceivedTexts] = useState<ReceivedText[]>([]);
  const [textInput, setTextInput] = useState('');
  const [sendMode, setSendMode] = useState<'file' | 'text'>('file');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    window.windrop.getSettings().then(setSettings);
    window.windrop.getWebURL().then(setWebURL);
    window.windrop.getTransferHistory().then(setTransferHistory);
    // 获取持久化的文本历史
    window.windrop.getTextHistory().then(setReceivedTexts);
    
    // 获取电脑设备
    window.windrop.getDevices().then(pcDevices => {
      setDevices(prev => [...prev.filter(d => d.type === 'mobile'), ...pcDevices.map(d => ({ ...d, type: 'pc' as const }))]);
    });
    
    // 获取已连接的手机
    window.windrop.getMobileClients().then(mobiles => {
      setDevices(prev => [...prev.filter(d => d.type === 'pc'), ...mobiles.map(m => ({ ...m, type: 'mobile' as const }))]);
    });
    
    window.windrop.onTransferHistoryUpdated(setTransferHistory);
    
    // 电脑设备事件
    window.windrop.onDeviceFound((d) => {
      setDevices(prev => {
        const exists = prev.find(x => x.id === d.id);
        if (exists) {
          // 已存在则原位更新
          return prev.map(x => x.id === d.id ? { ...d, type: 'pc' as const } : x);
        }
        // 新设备添加到末尾
        return [...prev, { ...d, type: 'pc' as const }];
      });
    });
    window.windrop.onDeviceLost((id) => {
      setDevices(prev => prev.filter(x => x.id !== id));
      setSelectedDevice(prev => prev === id ? null : prev);
    });
    
    // 手机设备事件
    window.windrop.onMobileConnected((m) => {
      setDevices(prev => {
        const exists = prev.find(x => x.id === m.id);
        if (exists) {
          // 已存在则原位更新
          return prev.map(x => x.id === m.id ? { ...m, type: 'mobile' as const } : x);
        }
        // 新设备添加到末尾
        return [...prev, { ...m, type: 'mobile' as const }];
      });
    });
    window.windrop.onMobileDisconnected((m) => {
      setDevices(prev => prev.filter(x => x.id !== m.id));
      setSelectedDevice(prev => prev === m.id ? null : prev);
      // 移除发给该手机的分享文件
      setSharedFiles(prev => prev.filter(f => f.targetId !== m.id));
    });
    window.windrop.onMobileUpdated((m) => {
      setDevices(prev => prev.map(x => x.id === m.id ? { ...x, name: m.name } : x));
    });
    
    window.windrop.onIncomingFile(setIncomingTransfer);
    window.windrop.onSendProgress(setSendProgress);
    window.windrop.onTransferProgress(setReceiveProgress);
    window.windrop.onSendComplete((r) => { setIsSending(false); setSendProgress(null); if (r.success) setSelectedFiles([]); });
    window.windrop.onTransferComplete(() => { setIsReceiving(false); setReceiveProgress(null); });
    window.windrop.onWebUploadStart((i) => setWebUploadProgress({ name: i.name, percent: 0 }));
    window.windrop.onWebUploadProgress(setWebUploadProgress);
    window.windrop.onWebUploadComplete(() => setWebUploadProgress(null));
    window.windrop.onFileDownloaded((i) => setSharedFiles(prev => prev.filter(f => f.id !== i.id)));
    // 只监听 text-history-updated，因为 main.ts 中 addTextRecord 会触发这个事件
    window.windrop.onTextHistoryUpdated(setReceivedTexts);
    window.windrop.onTextCopied((i) => setSharedTexts(prev => prev.filter(t => t.id !== i.id)));
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f: any) => f.path).map((f: any) => ({ name: f.name, size: f.size, path: f.path }));
    if (files.length) setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  const handleSelectFiles = async () => {
    const paths = await window.windrop.selectFiles();
    for (const p of paths) { const i = await window.windrop.getFileInfo(p); if (i) setSelectedFiles(prev => [...prev, i]); }
  };

  // 统一发送方法
  const handleSend = async () => {
    if (!selectedDevice || !selectedFiles.length) return;
    const device = devices.find(d => d.id === selectedDevice);
    if (!device) return;

    if (device.type === 'mobile') {
      // 发送给手机 - 分享文件
      for (const f of selectedFiles) {
        const id = await window.windrop.shareFileWeb(f.path, device.id);
        if (id) setSharedFiles(prev => [...prev, { id, ...f, targetId: device.id }]);
      }
      setSelectedFiles([]);
    } else {
      // 发送给电脑
      setIsSending(true);
      try { await window.windrop.sendFiles(selectedDevice, selectedFiles.map(f => f.path)); } catch { setIsSending(false); }
    }
  };

  const handleSaveSettings = async (s: Partial<Settings>) => {
    await window.windrop.setSettings(s);
    setSettings(prev => prev ? { ...prev, ...s } : null);
  };

  const formatSize = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : b < 1073741824 ? `${(b/1048576).toFixed(1)} MB` : `${(b/1073741824).toFixed(2)} GB`;
  const formatTime = (ts: number) => new Date(ts).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  // 发送文本到手机
  const handleSendText = async () => {
    if (!selectedDevice || !textInput.trim()) return;
    const device = devices.find(d => d.id === selectedDevice);
    if (!device || device.type !== 'mobile') return;
    const id = await window.windrop.shareTextWeb(textInput, device.id);
    if (id) setSharedTexts(prev => [...prev, { id, text: textInput, targetId: device.id }]);
    setTextInput('');
  };

  // 从剪贴板获取文本
  const handlePasteFromClipboard = async () => {
    const text = await window.windrop.getClipboardText();
    if (text) setTextInput(text);
  };

  const progress = isSending ? sendProgress : isReceiving ? receiveProgress : webUploadProgress ? { percent: webUploadProgress.percent, currentFile: webUploadProgress.name } : null;

  // 复制文本到剪贴板
  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setToast('复制失败');
      setTimeout(() => setToast(null), 2000);
    }
  };

  // 打开文件所在位置
  const handleOpenFile = async (filePath: string, id: string) => {
    try {
      await window.windrop.showFileInFolder(filePath);
      setOpenedId(id);
      setTimeout(() => setOpenedId(null), 1500);
    } catch {
      setToast('文件找不到');
      setTimeout(() => setToast(null), 2000);
    }
  };

  // 清空全部记录
  const handleClearAllHistory = async () => {
    await window.windrop.clearTransferHistory();
    await window.windrop.clearTextHistory();
    setTransferHistory([]);
    setReceivedTexts([]);
    setToast('已清空全部记录');
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="app" onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
      {/* 顶部栏 */}
      <header className="titlebar">
        <div className="titlebar-drag">
          <svg className="logo-icon" viewBox="0 0 1024 1024" fill="#3b82f6">
              <path d="M841.8 456.4c2.4-12.7 3.6-25.7 3.6-38.7 0-117.5-95.6-213.2-213.1-213.2-65.3 0-125.4 29.9-165.2 78.6-26.6-13.6-56.3-20.9-86.9-20.9-92.2 0-169.4 65.6-187.3 152.7-76.7 33.1-129 109.8-129 195.8 0 117.5 95.6 213.1 213.2 213.1h490.6c105.4 0 191.2-85.8 191.2-191.2-0.1-79.1-48.5-147.2-117.1-176.2z m-74.3 311.5H276.9c-86.9 0-157.3-70.4-157.3-157.3 0-75.9 53.8-139.2 125.3-154 0-1.1-0.2-2.2-0.2-3.3 0-74.7 60.6-135.3 135.4-135.3 41.6 0 78.7 18.8 103.5 48.3 21.3-61.6 79.7-105.9 148.5-105.9 86.9 0 157.3 70.4 157.3 157.3 0 29.1-8 56.2-21.8 79.6 74.7 0.1 135.2 60.6 135.2 135.3 0.1 74.7-60.5 135.3-135.3 135.3z"/>
              <path d="M767.7 531.3c-0.1 0-0.1 0 0 0-10.3 0-18.6 8.3-18.6 18.6s8.3 18.6 18.6 18.7c35.3 0 64 28.8 64 64.1s-28.7 64.1-64.1 64.1H276.9c-47.4 0-86-38.6-86-86 0-40.6 28.8-76 68.4-84.2 10.1-2.1 16.6-11.9 14.5-22-2.1-10.1-11.9-16.5-22-14.5-56.9 11.8-98.1 62.5-98.1 120.7 0 68 55.3 123.3 123.3 123.3h490.6c55.9 0 101.3-45.5 101.3-101.3 0-56-45.4-101.5-101.2-101.5zM527.3 401.1c9.7 3.3 20.3-1.8 23.7-11.5 12-34.7 44.6-57.9 81.2-57.9 47.4 0 86 38.6 86 86 0 15.1-4.1 30.2-11.9 43.4-5.2 8.9-2.3 20.3 6.6 25.5 3 1.7 6.2 2.6 9.4 2.6 6.4 0 12.6-3.3 16.1-9.2 11.2-19 17.1-40.6 17.1-62.3 0-68-55.3-123.3-123.3-123.3-52.4 0-99.2 33.4-116.4 83-3.3 9.7 1.8 20.3 11.5 23.7zM297.2 470.9h0.3c10.2 0 18.5-8.2 18.6-18.4 0.5-34.8 29.2-63.2 64.1-63.2 18.9 0 36.8 8.3 49 22.9 6.6 7.9 18.4 8.9 26.2 2.3 7.9-6.6 8.9-18.4 2.3-26.3-19.3-23-47.6-36.2-77.5-36.2-55.1 0-100.6 44.8-101.3 100-0.2 10.3 8 18.7 18.3 18.9z"/>
            </svg>
          <span className="logo-text">Airdrop</span>
        </div>
        <div className="titlebar-controls">
          <button onClick={() => window.windrop.minimize()} className="ctrl-btn"><svg viewBox="0 0 12 12"><rect y="5" width="12" height="2" fill="currentColor"/></svg></button>
          <button onClick={() => window.windrop.close()} className="ctrl-btn ctrl-close"><svg viewBox="0 0 12 12"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5"/></svg></button>
        </div>
      </header>

      <div className="layout">
        {/* 侧边导航 */}
        <nav className="sidebar">
          <div className="nav-group">
            <button className={`nav-btn ${view === 'transfer' ? 'active' : ''}`} onClick={() => setView('transfer')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
              <span>传输</span>
            </button>
            <button className={`nav-btn ${view === 'settings' ? 'active' : ''}`} onClick={() => setView('settings')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
              <span>设置</span>
            </button>
          </div>
          <div className="sidebar-footer">
            <div className="device-status"><div className="status-dot"></div><span>{settings?.deviceName || 'Airdrop'}</span></div>
            <button className="qr-btn-sidebar" onClick={() => setShowQR(true)} title="手机扫码连接">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 17h.01M17 14h.01M20 14h.01M14 20h.01M17 20h.01M20 17h.01"/></svg>
            </button>
          </div>
        </nav>

        {/* 主内容区 */}
        <main className="content">
          {view === 'settings' && (
            <div className="page">
              <div className="page-header"><h1>设置</h1><p>配置您的 Airdrop 偏好设置</p></div>
              <div className="settings-list">
                <div className="setting-item">
                  <div className="setting-label"><span className="setting-title">设备名称</span><span className="setting-desc">其他设备将看到此名称</span></div>
                  <input className="setting-input" value={settings?.deviceName || ''} onChange={e => handleSaveSettings({ deviceName: e.target.value })} />
                </div>
                <div className="setting-item">
                  <div className="setting-label"><span className="setting-title">下载位置</span><span className="setting-desc">{settings?.downloadPath || '未设置'}</span></div>
                  <div className="setting-actions">
                    <button className="btn-text" onClick={() => window.windrop.openDownloadFolder()}>打开</button>
                    <button className="btn-outline" onClick={async () => { const f = await window.windrop.selectFolder(); if (f) handleSaveSettings({ downloadPath: f }); }}>更改</button>
                  </div>
                </div>
                <div className="setting-item">
                  <div className="setting-label"><span className="setting-title">自动接受</span><span className="setting-desc">自动接受所有传入的文件</span></div>
                  <button className={`toggle ${settings?.autoAccept ? 'on' : ''}`} onClick={() => handleSaveSettings({ autoAccept: !settings?.autoAccept })}><span className="toggle-thumb"></span></button>
                </div>
                <div className="setting-item">
                  <div className="setting-label"><span className="setting-title">系统通知</span><span className="setting-desc">收到文件时显示通知</span></div>
                  <button className={`toggle ${settings?.showNotifications ? 'on' : ''}`} onClick={() => handleSaveSettings({ showNotifications: !settings?.showNotifications })}><span className="toggle-thumb"></span></button>
                </div>
              </div>
              <div className="mobile-tip">
                <div className="tip-icon">📱</div>
                <div className="tip-content">
                  <span className="tip-title">手机传输</span>
                  <span className="tip-url">{webURL}</span>
                </div>
                <button className="btn-outline" onClick={() => window.windrop.copyWebURL()}>复制</button>
              </div>
            </div>
          )}

          {view === 'transfer' && (
            <div className="page transfer-page two-column">
              <div className="transfer-left">
              {/* 模式切换 */}
              <div className="mode-tabs">
                <button className={`mode-tab ${sendMode === 'file' ? 'active' : ''}`} onClick={() => setSendMode('file')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>
                  文件
                </button>
                <button className={`mode-tab ${sendMode === 'text' ? 'active' : ''}`} onClick={() => setSendMode('text')}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                  文本
                </button>
              </div>

              {/* 文件选择区 */}
              {sendMode === 'file' ? (
                <div className={`drop-zone ${isDragging ? 'dragging' : ''} ${selectedFiles.length ? 'has-files' : ''}`}>
                  {selectedFiles.length === 0 ? (
                    <div className="drop-placeholder">
                      <div className="drop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg></div>
                      <p className="drop-text">拖放文件到此处</p>
                      <button className="btn-outline" onClick={handleSelectFiles}>选择文件</button>
                    </div>
                  ) : (
                    <div className="file-list">
                      <div className="file-list-header"><span>已选择 {selectedFiles.length} 个文件</span><button className="btn-text danger" onClick={() => setSelectedFiles([])}>清空</button></div>
                      <div className="file-items">
                        {selectedFiles.map((f, i) => (
                          <div key={i} className="file-item">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>
                            <span className="file-name">{f.name}</span>
                            <span className="file-size">{formatSize(f.size)}</span>
                            <button className="btn-icon-sm" onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                          </div>
                        ))}
                      </div>
                      <button className="btn-text" onClick={handleSelectFiles}>+ 添加更多</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-input-zone">
                  <textarea 
                    className="text-area" 
                    placeholder="输入要发送的文本..." 
                    value={textInput} 
                    onChange={e => setTextInput(e.target.value)}
                    rows={4}
                  />
                  <div className="text-input-actions">
                    <button className="btn-text" onClick={handlePasteFromClipboard}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      粘贴
                    </button>
                    <span className="text-count">{textInput.length} 字</span>
                  </div>
                </div>
              )}

              {/* 设备列表 */}
              <div className="section">
                <div className="section-header">
                  <h2>附近设备</h2>
                  <span className="device-count">{devices.length} 台设备</span>
                </div>
                {devices.length === 0 ? (
                  <div className="empty-devices">
                    <div className="scanning"><span></span><span></span><span></span></div>
                    <p>正在搜索设备...</p>
                    <button className="btn-qr-link" onClick={() => setShowQR(true)}>📱 手机扫码连接</button>
                  </div>
                ) : (
                  <div className="device-grid">
                    {devices.map(d => (
                      <div key={d.id} className={`device-card ${selectedDevice === d.id ? 'selected' : ''}`} onClick={() => setSelectedDevice(selectedDevice === d.id ? null : d.id)}>
                        <div className={`device-avatar ${d.type}`}>
                          {d.type === 'mobile' ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                          )}
                        </div>
                        <div className="device-details">
                          <span className="device-name">{d.name}</span>
                          <span className="device-ip">{d.ip}</span>
                        </div>
                        {selectedDevice === d.id && (
                          <div className="device-actions">
                            {sendMode === 'file' && selectedFiles.length > 0 && (
                              <button className="btn-send-inline" onClick={(e) => { e.stopPropagation(); handleSend(); }} disabled={isSending}>
                                {isSending ? '...' : '发送'}
                              </button>
                            )}
                            {sendMode === 'text' && textInput.trim() && d.type === 'mobile' && (
                              <button className="btn-send-inline" onClick={(e) => { e.stopPropagation(); handleSendText(); }}>
                                发送
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 等待手机下载 */}
              {sharedFiles.length > 0 && (
                <div className="section pending-section">
                  <div className="section-header"><h2>等待下载</h2><span className="pending-count">{sharedFiles.length}</span></div>
                  <div className="pending-list">
                    {sharedFiles.map(f => {
                      const target = devices.find(d => d.id === f.targetId);
                      return (
                        <div key={f.id} className="pending-item">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>
                          <div className="pending-info">
                            <span className="pending-name">{f.name}</span>
                            <span className="pending-target">→ {target?.name || '手机'}</span>
                          </div>
                          <span className="pending-size">{formatSize(f.size)}</span>
                          <button className="btn-icon-sm" onClick={() => { window.windrop.unshareFileWeb(f.id); setSharedFiles(prev => prev.filter(x => x.id !== f.id)); }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              </div>

              {/* 右侧传输记录 */}
              <div className="transfer-right">
                <div className="section-header">
                  <h2>传输记录</h2>
                  {(transferHistory.length > 0 || receivedTexts.length > 0) && (
                    <button className="btn-clear" onClick={handleClearAllHistory} title="清空全部记录">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </button>
                  )}
                </div>
                <div className="history-list-full-right">
                  {(() => {
                    const allRecords = [
                      ...receivedTexts.map((t) => ({ recordType: 'text' as const, id: t.id, text: t.text, from: t.from, timestamp: t.timestamp })),
                      ...transferHistory.map(r => ({ recordType: 'file' as const, ...r }))
                    ].sort((a, b) => b.timestamp - a.timestamp);

                    if (allRecords.length === 0) {
                      return <div className="empty-history"><span>暂无记录</span></div>;
                    }

                    return allRecords.map(r => {
                      if (r.recordType === 'text') {
                        const isCopied = copiedId === r.id;
                        return (
                          <div key={r.id} className={`history-item-full text ${isCopied ? 'success' : ''}`} onClick={() => handleCopyText(r.text, r.id)}>
                            <div className="history-icon-full text">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                            </div>
                            <div className="history-content-full">
                              <div className="history-main">
                                <span className="history-name-full">{r.text}</span>
                              </div>
                              <div className="history-meta-full">
                                <span className="history-from">{r.from}</span>
                                <span className="history-time-full">{formatTime(r.timestamp)}</span>
                              </div>
                            </div>
                            <span className={`history-action-icon ${isCopied ? 'success' : ''}`}>
                              {isCopied ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                              )}
                            </span>
                          </div>
                        );
                      } else {
                        const isOpened = openedId === r.id;
                        const ext = r.fileName.split('.').pop()?.toLowerCase() || '';
                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext);
                        const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);
                        const isAudio = ['mp3', 'wav', 'flac', 'aac', 'm4a'].includes(ext);
                        const isDoc = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext);
                        const fileTypeClass = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : isDoc ? 'doc' : 'file';
                        return (
                          <div key={r.id} className={`history-item-full file ${isOpened ? 'success' : ''}`} onClick={() => handleOpenFile(r.filePath, r.id)}>
                            <div className={`history-icon-full ${fileTypeClass}`}>
                              {isImage ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                              ) : isVideo ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M10 8l6 4-6 4V8z"/></svg>
                              ) : isAudio ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                              ) : isDoc ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>
                              )}
                            </div>
                            <div className="history-content-full">
                              <div className="history-main">
                                <span className="history-name-full">{r.fileName}</span>
                              </div>
                              <div className="history-meta-full">
                                <span className="history-from">{r.from}</span>
                                <span className="history-size-full">{formatSize(r.size)}</span>
                                <span className="history-time-full">{formatTime(r.timestamp)}</span>
                              </div>
                            </div>
                            <span className={`history-action-icon ${isOpened ? 'success' : ''}`}>
                              {isOpened ? (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>
                              ) : (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6"/><path d="M10 14L21 3"/></svg>
                              )}
                            </span>
                          </div>
                        );
                      }
                    });
                  })()}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* 进度条 */}
      {progress && (
        <div className="progress-toast">
          <div className="progress-content"><span className="progress-label">{isSending ? '发送' : '接收'}: {progress.currentFile}</span><span className="progress-percent">{progress.percent}%</span></div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress.percent}%` }}></div></div>
        </div>
      )}

      {/* 接收弹窗 */}
      {incomingTransfer && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M19 12l-7 7-7-7"/></svg></div>
            <h2>收到文件</h2>
            <p className="modal-sender">来自 <strong>{incomingTransfer.senderName}</strong></p>
            <div className="modal-files">{incomingTransfer.files.map((f, i) => <div key={i} className="modal-file"><span>{f.name}</span><span>{formatSize(f.size)}</span></div>)}</div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { window.windrop.rejectTransfer(incomingTransfer.transferId); setIncomingTransfer(null); }}>拒绝</button>
              <button className="btn-primary" onClick={() => { window.windrop.acceptTransfer(incomingTransfer.transferId); setIncomingTransfer(null); setIsReceiving(true); }}>接受</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && <div className="toast">{toast}</div>}

      {/* 二维码弹窗 */}
      {showQR && (
        <div className="modal-backdrop" onClick={() => setShowQR(false)}>
          <div className="qr-modal" onClick={e => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h3>手机扫码连接</h3>
              <button className="btn-icon-sm" onClick={() => setShowQR(false)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
            </div>
            <div className="qr-modal-body">
              <div className="qr-code-large">
                <QRCodeSVG value={webURL} size={160} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>
              <p className="qr-url">{webURL}</p>
              <button className="btn-outline" onClick={() => { window.windrop.copyWebURL(); }}>复制链接</button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}

export default App;
