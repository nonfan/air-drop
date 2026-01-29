import { FileDropZone } from './FileDropZone';
import { TextInput } from './TextInput';
import { DeviceList } from './DeviceList';
import { HistoryList } from './HistoryList';

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
  onSend: () => void;
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
  onDownloadFile
}: TransferPageProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  return (
    <div className="flex flex-col w-full h-full min-[1024px]:flex-row">
      {/* 主内容区 */}
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="w-full max-w-full mx-auto space-y-4">
          {/* 模式切换 */}
          <div className="flex gap-1 bg-secondary border border-custom rounded-xl p-1">
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

          {/* 内容区 */}
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

          {/* 设备列表 */}
          <div>
            <h2 className="text-base font-medium mb-3">选择设备</h2>
            <DeviceList
              devices={devices}
              selectedDevice={selectedDevice}
              onSelectDevice={onSelectDevice}
            />
          </div>

          {/* 发送按钮 */}
          <button
            onClick={onSend}
            disabled={!selectedDevice || (mode === 'file' ? selectedFiles.length === 0 : !text.trim()) || isSending}
            className="w-full h-12 rounded-xl font-semibold text-base transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-accent text-white hover:bg-accent-hover active:scale-[0.98]"
          >
            {isSending ? (
              <>
                <div className="spinner"></div>
                {sendProgress ? `${sendProgress.percent}%` : '发送中...'}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
                {mode === 'file'
                  ? selectedFiles.length > 0 ? `发送 ${selectedFiles.length} 个文件` : '发送文件'
                  : text.trim() ? '发送文本' : '发送'}
              </>
            )}
          </button>

          {/* 传输记录 - 移动端 */}
          <div className="min-[1024px]:hidden">
            <div className="pt-6 pb-3 flex items-center justify-between">
              <h2 className="text-base font-medium">传输记录</h2>
              {history.length > 0 && (
                <button onClick={onClearHistory} className="text-xs text-danger hover:text-danger/80 font-medium">
                  清空
                </button>
              )}
            </div>
            <div>
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center mb-2">
                    <svg className="w-5 h-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-muted">暂无记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history.filter(item => item.direction === 'received').slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => item.type === 'text' && item.content ? onCopyText(item.content, item.id) : item.filePath && onDownloadFile(item.filePath, item.fileName!, item.id)}
                      className="w-full p-2.5 rounded-lg bg-secondary hover:bg-hover transition-colors text-left border border-custom relative"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === 'text' ? 'bg-accent/10' : 'bg-success/10'
                          }`}>
                          {item.type === 'text' ? (
                            <svg className="w-3.5 h-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-success" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                              <path d="M13 2v7h7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {item.type === 'text' ? item.content : item.fileName}
                          </div>
                          <div className="text-[10px] text-muted mt-0.5">
                            {item.direction === 'sent' ? '已发送' : '已接收'}
                          </div>
                        </div>
                        {copiedId === item.id && (
                          <div className="text-[10px] px-2 py-1 rounded bg-success/20 text-success font-medium flex-shrink-0">
                            已复制
                          </div>
                        )}
                      </div>
                    </button>
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
