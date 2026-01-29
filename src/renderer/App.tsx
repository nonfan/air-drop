/// <reference path="./types.d.ts" />
import { useState, useEffect, useCallback } from 'react';
import {
  Titlebar,
  Sidebar,
  DeviceList,
  FileDropZone,
  TextInput,
  HistoryList,
  QRModal,
  SettingsPage
} from './components';
import { useTheme, useScroll, usePaste } from './hooks';
import { formatSize, formatTime } from './utils';
import type {
  Device,
  FileTransferInfo,
  Settings,
  TransferProgress,
  TransferRecord,
  FileItem,
  SharedFile,
  ReceivedText
} from './types';

type View = 'transfer' | 'settings';

function App() {
  const [view, setView] = useState<View>('transfer');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [incomingTransfer, setIncomingTransfer] = useState<FileTransferInfo | null>(null);
  const [sendProgress, setSendProgress] = useState<TransferProgress | null>(null);
  const [receiveProgress, setReceiveProgress] = useState<TransferProgress | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [sendMode, setSendMode] = useState<'file' | 'text'>('file');
  const [textInput, setTextInput] = useState('');
  const [receivedTexts, setReceivedTexts] = useState<ReceivedText[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [webURL, setWebURL] = useState('');
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [showQR, setShowQR] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [missingFiles, setMissingFiles] = useState<Set<string>>(new Set());
  const [appVersion, setAppVersion] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'>('idle');
  const [updateInfo, setUpdateInfo] = useState<{ version?: string; percent?: number; error?: string }>({});

  useTheme(settings?.theme);
  const { showScrollTop, scrollToTop } = useScroll('#historyContent');

  usePaste((files: FileItem[]) => {
    setSelectedFiles(prev => [...prev, ...files]);
    setSendMode('file');
  });

  useEffect(() => {
    // 添加错误处理，避免在主进程未就绪时报错
    const initializeApp = async () => {
      try {
        const [
          settingsData,
          webURLData,
          versionData,
          historyData,
          textHistoryData,
          devicesData,
          mobileClientsData
        ] = await Promise.allSettled([
          window.windrop.getSettings(),
          window.windrop.getWebURL(),
          window.windrop.getAppVersion(),
          window.windrop.getTransferHistory(),
          window.windrop.getTextHistory(),
          window.windrop.getDevices(),
          window.windrop.getMobileClients()
        ]);

        if (settingsData.status === 'fulfilled') setSettings(settingsData.value);
        if (webURLData.status === 'fulfilled') setWebURL(webURLData.value);
        if (versionData.status === 'fulfilled') setAppVersion(versionData.value);
        if (historyData.status === 'fulfilled') setTransferHistory(historyData.value);
        if (textHistoryData.status === 'fulfilled') setReceivedTexts(textHistoryData.value);
        if (devicesData.status === 'fulfilled') {
          setDevices(prev => [...prev.filter(d => d.type === 'mobile'), ...devicesData.value.map(d => ({ ...d, type: 'pc' as const }))]);
        }
        if (mobileClientsData.status === 'fulfilled') {
          setDevices(prev => [...prev.filter(d => d.type === 'pc'), ...mobileClientsData.value.map(m => ({ ...m, type: 'mobile' as const }))]);
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initializeApp();

    window.windrop.onTransferHistoryUpdated(setTransferHistory);
    window.windrop.onTextHistoryUpdated(setReceivedTexts);
    window.windrop.onDeviceFound((d) => {
      setDevices(prev => {
        const exists = prev.find(x => x.id === d.id);
        if (exists) return prev.map(x => x.id === d.id ? { ...d, type: 'pc' as const } : x);
        return [...prev, { ...d, type: 'pc' as const }];
      });
    });
    window.windrop.onDeviceLost((id) => {
      setDevices(prev => prev.filter(x => x.id !== id));
      setSelectedDevice(prev => prev === id ? null : prev);
    });
    window.windrop.onMobileConnected((m) => {
      setDevices(prev => {
        const exists = prev.find(x => x.id === m.id);
        if (exists) return prev.map(x => x.id === m.id ? { ...m, type: 'mobile' as const } : x);
        return [...prev, { ...m, type: 'mobile' as const }];
      });
    });
    window.windrop.onMobileDisconnected((m) => {
      setDevices(prev => prev.filter(x => x.id !== m.id));
      setSelectedDevice(prev => prev === m.id ? null : prev);
      setSharedFiles(prev => prev.filter(f => f.targetId !== m.id));
    });
    window.windrop.onMobileUpdated((m) => {
      setDevices(prev => prev.map(x => x.id === m.id ? { ...x, name: m.name, model: m.model } : x));
    });
    window.windrop.onIncomingFile(setIncomingTransfer);
    window.windrop.onSendProgress(setSendProgress);
    window.windrop.onTransferProgress((progress) => {
      setReceiveProgress(progress);
      setIsDownloading(true);
    });
    window.windrop.onSendComplete((r) => {
      setIsSending(false);
      setSendProgress(null);
      setIsDownloading(false);
      if (r.success) {
        setSelectedFiles([]);
      } else {
        setToast(r.reason ? `发送失败: ${r.reason}` : '发送失败');
        setTimeout(() => setToast(null), 3000);
      }
    });
    window.windrop.onTransferComplete(() => {
      setReceiveProgress(null);
      setIsDownloading(false);
    });
    window.windrop.onFileDownloaded((i) => setSharedFiles(prev => prev.filter(f => f.id !== i.id)));
    window.windrop.onWebDownloadFailed((info) => {
      // 网页端下载失败，显示通知
      setToast(`${info.clientName} 下载 ${info.fileName} 失败`);
      setTimeout(() => setToast(null), 3000);
    });
    window.windrop.onUpdateAvailable((info) => {
      setUpdateStatus('available');
      setUpdateInfo({ version: info.version });
    });
    window.windrop.onUpdateNotAvailable(() => {
      setUpdateStatus('idle');
      setToast('已是最新版本');
      setTimeout(() => setToast(null), 2000);
    });
    window.windrop.onUpdateDownloadProgress((progress) => {
      setUpdateStatus('downloading');
      setUpdateInfo(prev => ({ ...prev, percent: Math.round(progress.percent) }));
    });
    window.windrop.onUpdateDownloaded(() => setUpdateStatus('ready'));
    window.windrop.onUpdateError((error) => {
      setUpdateStatus('error');
      setUpdateInfo({ error });
    });
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files)
      .filter((f: any) => f.path)
      .map((f: any) => ({ name: f.name, size: f.size, path: f.path }));
    if (files.length) setSelectedFiles(prev => [...prev, ...files]);
  }, []);

  const handleSelectFiles = async () => {
    const paths = await window.windrop.selectFiles();
    for (const p of paths) {
      const i = await window.windrop.getFileInfo(p);
      if (i) setSelectedFiles(prev => [...prev, i]);
    }
  };

  const handleSend = async () => {
    if (!selectedDevice || !selectedFiles.length) return;
    const device = devices.find(d => d.id === selectedDevice);
    if (!device) return;
    if (device.type === 'mobile') {
      for (const f of selectedFiles) {
        const id = await window.windrop.shareFileWeb(f.path, device.id);
        if (id) setSharedFiles(prev => [...prev, { id, ...f, targetId: device.id }]);
      }
      setSelectedFiles([]);
    } else {
      setIsSending(true);
      try {
        await window.windrop.sendFiles(selectedDevice, selectedFiles.map(f => f.path));
      } catch {
        setIsSending(false);
      }
    }
  };

  const handleSendText = async () => {
    if (!selectedDevice || !textInput.trim()) return;
    const device = devices.find(d => d.id === selectedDevice);
    if (!device || device.type !== 'mobile') return;
    await window.windrop.shareTextWeb(textInput, device.id);
    setTextInput('');
  };

  return (
    <div
      className="app"
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar view={view} settings={settings} onViewChange={setView} onShowQR={() => setShowQR(true)} />
        <main className="flex-1 flex flex-col overflow-hidden">
          {view === 'settings' ? (
            <SettingsPage
              settings={settings}
              appVersion={appVersion}
              updateStatus={updateStatus}
              updateInfo={updateInfo}
              onSaveSettings={async (s) => {
                await window.windrop.setSettings(s);
                setSettings(prev => prev ? { ...prev, ...s } : null);
              }}
              onCheckUpdate={async () => {
                setUpdateStatus('checking');
                setUpdateInfo({});
                await window.windrop.checkForUpdates();
              }}
              onDownloadUpdate={async () => {
                setUpdateStatus('downloading');
                setUpdateInfo(prev => ({ ...prev, percent: 0 }));
                await window.windrop.downloadUpdate();
              }}
              onInstallUpdate={() => window.windrop.installUpdate()}
            />
          ) : (
            <div className="flex flex-row h-full w-full overflow-hidden">
              <div className="flex-1 min-w-0 p-6 overflow-y-auto space-y-6">
                <div className="flex gap-1 bg-secondary border border-custom rounded-xl p-1">
                  <button
                    onClick={() => setSendMode('file')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${sendMode === 'file' ? 'bg-accent text-white' : 'text-muted hover:text-secondary'
                      }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                      <path d="M13 2v7h7" />
                    </svg>
                    文件
                  </button>
                  <button
                    onClick={() => setSendMode('text')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${sendMode === 'text' ? 'bg-accent text-white' : 'text-muted hover:text-secondary'
                      }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    文本
                  </button>
                </div>

                {sendMode === 'file' ? (
                  <FileDropZone
                    isDragging={isDragging}
                    selectedFiles={selectedFiles}
                    sharedFiles={sharedFiles}
                    isSending={isSending}
                    isDownloading={isDownloading}
                    sendProgress={sendProgress}
                    receiveProgress={receiveProgress}
                    devices={devices}
                    onSelectFiles={handleSelectFiles}
                    onRemoveFile={(i) => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))}
                    onClearFiles={() => setSelectedFiles([])}
                    onRemoveSharedFile={(id) => {
                      window.windrop.unshareFileWeb(id);
                      setSharedFiles(prev => prev.filter(x => x.id !== id));
                    }}
                    formatSize={formatSize}
                  />
                ) : (
                  <TextInput
                    textInput={textInput}
                    onTextChange={setTextInput}
                    onPasteFromClipboard={async () => {
                      const text = await window.windrop.getClipboardText();
                      if (text) setTextInput(text);
                    }}
                  />
                )}

                <DeviceList
                  devices={devices}
                  selectedDevice={selectedDevice}
                  onSelectDevice={(id) => setSelectedDevice(selectedDevice === id ? null : id)}
                  sendMode={sendMode}
                  selectedFiles={selectedFiles}
                  textInput={textInput}
                  isSending={isSending}
                  onSend={handleSend}
                  onSendText={handleSendText}
                  onShowQR={() => setShowQR(true)}
                />
              </div>

              <HistoryList
                transferHistory={transferHistory}
                receivedTexts={receivedTexts}
                showAllHistory={showAllHistory}
                copiedId={copiedId}
                openedId={openedId}
                missingFiles={missingFiles}
                onToggleShowAll={() => setShowAllHistory(!showAllHistory)}
                onClearAll={async () => {
                  await window.windrop.clearTransferHistory();
                  await window.windrop.clearTextHistory();
                  setTransferHistory([]);
                  setReceivedTexts([]);
                  setToast('已清空全部记录');
                  setTimeout(() => setToast(null), 2000);
                }}
                onCopyText={async (text, id) => {
                  try {
                    const success = await window.windrop.copyText(text);
                    if (success) {
                      setCopiedId(id);
                      setTimeout(() => setCopiedId(null), 1500);
                    } else {
                      setToast('复制失败');
                      setTimeout(() => setToast(null), 2000);
                    }
                  } catch {
                    setToast('复制失败');
                    setTimeout(() => setToast(null), 2000);
                  }
                }}
                onOpenFile={async (filePath, id) => {
                  try {
                    const success = await window.windrop.showFileInFolder(filePath);
                    if (success) {
                      setOpenedId(id);
                      setTimeout(() => setOpenedId(null), 1500);
                      setMissingFiles(prev => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                      });
                    } else {
                      setMissingFiles(prev => new Set(prev).add(id));
                      setToast('文件已被删除或移动');
                      setTimeout(() => setToast(null), 2000);
                    }
                  } catch {
                    setMissingFiles(prev => new Set(prev).add(id));
                    setToast('文件已被删除或移动');
                    setTimeout(() => setToast(null), 2000);
                  }
                }}
                formatSize={formatSize}
                formatTime={formatTime}
              />
            </div>
          )}

          {/* Footer - 桌面端 */}
          {view === 'transfer' && (
            <div className="flex-shrink-0 px-6 py-3 border-t border-border bg-secondary/50">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>{settings?.deviceName || 'Airdrop'}</span>
                <span>v{appVersion || '1.0.0'}</span>
              </div>
            </div>
          )}
        </main>
      </div>

      {incomingTransfer && (
        <div className="modal-backdrop">
          <div className="bg-secondary border border-custom rounded-3xl p-6 w-full max-w-md mx-4">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M19 12l-7 7-7-7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-center mb-2">收到文件</h2>
            <p className="text-sm text-center text-muted mb-4">来自 <strong className="text-primary">{incomingTransfer.senderName}</strong></p>
            <div className="bg-tertiary rounded-xl p-3 mb-6 max-h-40 overflow-y-auto space-y-2">
              {incomingTransfer.files.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{f.name}</span>
                  <span className="text-muted ml-2">{formatSize(f.size)}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  window.windrop.rejectTransfer(incomingTransfer.transferId);
                  setIncomingTransfer(null);
                }}
                className="flex-1 py-3 bg-tertiary border border-custom rounded-xl font-medium hover:bg-hover transition-all"
              >
                拒绝
              </button>
              <button
                onClick={() => {
                  window.windrop.acceptTransfer(incomingTransfer.transferId);
                  setIncomingTransfer(null);
                }}
                className="flex-1 py-3 bg-accent text-white rounded-xl font-medium hover:bg-accent-hover transition-all"
              >
                接受
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
      {showScrollTop && (
        <button className="scroll-to-top" onClick={scrollToTop} title="回到顶部">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      )}
      {showQR && (
        <QRModal
          webURL={webURL}
          copiedId={copiedId}
          onClose={() => setShowQR(false)}
          onCopy={() => {
            window.windrop.copyWebURL();
            setCopiedId('url');
            setTimeout(() => setCopiedId(null), 1500);
          }}
        />
      )}
    </div>
  );
}

export default App;
