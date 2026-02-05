import { FileDropZone } from './FileDropZone';
import { TextInput } from './TextInput';
import { DeviceList } from '../../shared/components/DeviceList';
import { HistoryList } from '../../shared/components/HistoryList';
import { HistoryItem } from '../../shared/components/HistoryItem';

interface Device {
  id: string;
  name: string;
  model: string;
  ip: string;
  type: 'pc' | 'mobile';
}

interface FileItem {
  name: string;
  size: number;
  file: File;
}

interface TransferProgress {
  percent: number;
  currentFile: string;
  totalSize: number;
  sentSize?: number;
}

interface HistoryItem {
  id: string;
  type: 'text' | 'file';
  content?: string;
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  timestamp: number;
  status: 'success' | 'failed' | 'pending';
  direction: 'sent' | 'received';
  from?: string;
}

interface TransferPageProps {
  mode: 'file' | 'text';
  onModeChange: (mode: 'file' | 'text') => void;
  devices: Device[];
  selectedDevice: string | null;
  onSelectDevice: (id: string) => void;
  selectedFiles: FileItem[];
  onFilesChange: (files: FileItem[]) => void;
  onSelectFiles: () => void;
  text: string;
  onTextChange: (text: string) => void;
  isDragging: boolean;
  isSending: boolean;
  sendProgress: TransferProgress | null;
  downloadProgress: TransferProgress | null;
  onSend: (deviceId?: string) => void;
  history: HistoryItem[];
  showAllHistory: boolean;
  onToggleShowAll: () => void;
  onClearHistory: () => void;
  copiedId: string | null;
  copyFailedId: string | null;
  copiedTextIds: Set<string>;
  downloadingId: string | null;
  downloadFailedId: string | null;
  downloadedIds: Set<string>;
  downloadFailedIds: Set<string>;
  downloadProgressMap: Map<string, { percent: number; receivedSize: number; totalSize: number }>;
  onCopyText: (text: string, id: string) => void;
  onDownloadFile: (filePath: string, fileName: string, itemId: string) => void;
  onShowTextModal?: () => void;
  isMobile: boolean;
}

export function TransferPage({
  mode,
  onModeChange,
  devices,
  selectedDevice,
  onSelectDevice,
  selectedFiles,
  onFilesChange,
  onSelectFiles,
  text,
  onTextChange,
  isDragging,
  isSending,
  sendProgress,
  downloadProgress,
  onSend,
  history,
  showAllHistory,
  onToggleShowAll,
  onClearHistory,
  copiedId,
  copyFailedId,
  copiedTextIds,
  downloadingId,
  downloadFailedId,
  downloadedIds,
  downloadFailedIds,
  downloadProgressMap,
  onCopyText,
  onDownloadFile,
  onShowTextModal,
  isMobile
}: TransferPageProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  // 筛选当天的记录
  const getTodayHistory = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    return history.filter(item => {
      const itemDate = new Date(item.timestamp);
      itemDate.setHours(0, 0, 0, 0);
      return itemDate.getTime() === todayTimestamp;
    });
  };

  const todayHistory = getTodayHistory();

  return (
    <div className="flex flex-col w-full h-full min-[1024px]:flex-row">
      {/* 主内容区 */}
      <div className="flex-1 min-w-0 px-6 py-4 md:p-6 md:pb-6 overflow-y-auto">
        <div className="w-full max-w-full mx-auto space-y-6 pb-4 md:pb-0">{/* 移动端添加底部 padding */}
          {/* 发送快捷操作 - 仅移动端显示 */}
          <div className="md:hidden">
            <h2 className="text-sm font-medium mb-3">发送</h2>
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => {
                  // 点击文件按钮时清除文本
                  if (text.trim()) {
                    onTextChange('');
                  }
                  onSelectFiles();
                }}
                className="flex flex-col items-center gap-2 transition-transform active:scale-95"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                    <path d="M13 2v7h7" />
                  </svg>
                </div>
                <span className="text-xs text-foreground">文件</span>
              </button>

              <button
                onClick={() => {
                  // 点击照片按钮时清除文本
                  if (text.trim()) {
                    onTextChange('');
                  }
                  onSelectFiles();
                }}
                className="flex flex-col items-center gap-2 transition-transform active:scale-95"
              >
                <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>
                <span className="text-xs text-foreground">照片</span>
              </button>

              <button
                onClick={onShowTextModal}
                className="flex flex-col items-center gap-2 transition-transform active:scale-95"
              >
                <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <path d="M14 2v6h6M16 13H8m8 4H8m2-8H8" />
                  </svg>
                </div>
                <span className="text-xs text-foreground">文本</span>
              </button>

              <button
                onClick={() => {
                  // 点击文件夹按钮时清除文本
                  if (text.trim()) {
                    onTextChange('');
                  }
                  onSelectFiles();
                }}
                className="flex flex-col items-center gap-2 transition-transform active:scale-95"
              >
                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <svg className="w-7 h-7 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </div>
                <span className="text-xs text-foreground">文件夹</span>
              </button>
            </div>

            {/* 已选择内容预览 - 仅移动端显示 */}
            {(selectedFiles.length > 0 || text.trim()) && (
              <div className="mt-3 p-3 bg-secondary rounded-xl border border-black/20">
                {selectedFiles.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                      <path d="M13 2v7h7" />
                    </svg>
                    <span className="text-sm text-foreground truncate flex-1">
                      {selectedFiles.length === 1
                        ? selectedFiles[0].name
                        : `${selectedFiles.length} 个文件`}
                    </span>
                    <button
                      onClick={() => onFilesChange([])}
                      className="p-1 hover:bg-hover rounded transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-pink-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                      <path d="M14 2v6h6M16 13H8m8 4H8m2-8H8" />
                    </svg>
                    <span className="text-sm text-foreground truncate flex-1">{text}</span>
                    <button
                      onClick={() => onTextChange('')}
                      className="p-1 hover:bg-hover rounded transition-colors flex-shrink-0"
                    >
                      <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 模式切换 - 仅桌面端显示 */}
          <div className="hidden md:flex gap-1 bg-secondary border border-custom rounded-xl p-1">
            <button
              onClick={() => onModeChange('file')}
              className={`mode-btn ${mode === 'file' ? 'active' : ''}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                <path d="M13 2v7h7" />
              </svg>
              文件
            </button>
            <button
              onClick={() => onModeChange('text')}
              className={`mode-btn ${mode === 'text' ? 'active' : ''}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
              文本
            </button>
          </div>

          {/* 内容区 - 仅桌面端显示 */}
          <div className="hidden md:block">
            {mode === 'file' ? (
              <FileDropZone
                files={selectedFiles}
                onFilesChange={onFilesChange}
                onSelectFiles={onSelectFiles}
                isDragging={isDragging}
                isSending={isSending}
                sendProgress={sendProgress}
              />
            ) : (
              <TextInput value={text} onChange={onTextChange} />
            )}
          </div>

          {/* 设备列表 */}
          <div>
            <h2 className="text-sm font-medium mb-3">
              选择设备
              {(selectedFiles.length > 0 || text.trim().length > 0) && devices.length > 0 && !isSending && (
                <span className="text-xs text-muted font-normal ml-1">(点击设备即可发送)</span>
              )}
            </h2>
            <DeviceList
              devices={devices}
              selectedDevice={selectedDevice}
              onSelectDevice={onSelectDevice}
              onSendToDevice={(deviceId) => {
                console.log('[TransferPage] Device clicked:', {
                  deviceId,
                  selectedFilesCount: selectedFiles.length,
                  textLength: text.trim().length,
                  canSend: selectedFiles.length > 0 || text.trim().length > 0
                });
                // 先选中设备，然后直接发送到该设备
                onSelectDevice(deviceId);
                onSend(deviceId);
              }}
              canSend={selectedFiles.length > 0 || text.trim().length > 0}
            />
          </div>

          {/* 提示文本 */}
          {/* 已移至标题中显示 */}

          {/* 发送进度 - 已移除，进度显示在 History 记录中 */}

          {/* 传输记录 - 移动端 */}
          <div className="min-[1024px]:hidden">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium">今日传输</h2>
              {todayHistory.length > 0 && (
                <span className="text-xs text-muted">{todayHistory.length} 条记录</span>
              )}
            </div>
            <div>
              {todayHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-muted">今日暂无记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayHistory.slice(0, 5).map((item) => (
                    <HistoryItem
                      key={item.id}
                      item={item}
                      copiedId={copiedId}
                      copyFailedId={copyFailedId}
                      copiedTextIds={copiedTextIds}
                      downloadingId={downloadingId}
                      downloadFailedId={downloadFailedId}
                      downloadedIds={downloadedIds}
                      downloadFailedIds={downloadFailedIds}
                      downloadProgressMap={downloadProgressMap}
                      onCopyText={onCopyText}
                      onDownloadFile={onDownloadFile}
                      compact={true}
                      isMobile={isMobile}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 右侧传输记录 - 桌面端 */}
      <div className="flex-1 bg-secondary border-l border-border flex-col flex-shrink-0 hidden min-[1024px]:flex overflow-y-auto">
        <HistoryList
          history={history}
          showAllHistory={showAllHistory}
          copiedId={copiedId}
          copyFailedId={copyFailedId}
          copiedTextIds={copiedTextIds}
          downloadingId={downloadingId}
          downloadFailedId={downloadFailedId}
          downloadedIds={downloadedIds}
          downloadFailedIds={downloadFailedIds}
          downloadProgressMap={downloadProgressMap}
          onToggleShowAll={onToggleShowAll}
          onClearAll={onClearHistory}
          onCopyText={onCopyText}
          onDownloadFile={onDownloadFile}
          isMobile={isMobile}
        />

        {/* 下载进度条 - 固定在底部 */}
        {downloadProgress && (
          <div className="border-t border-border bg-background p-4 flex-shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <svg className="w-5 h-5 text-success animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{downloadProgress.currentFile}</div>
                <div className="text-xs text-muted mt-0.5">
                  {downloadProgress.totalSize > 0
                    ? `${formatSize(downloadProgress.sentSize || 0)} / ${formatSize(downloadProgress.totalSize)}`
                    : '正在下载...'}
                </div>
              </div>
              <div className="text-sm font-semibold text-success">{downloadProgress.percent}%</div>
            </div>
            <div className="w-full h-2 bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-success transition-all duration-300 rounded-full"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
