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

interface HistoryListProps {
  history: HistoryItem[];
  showAllHistory: boolean;
  copiedId: string | null;
  copyFailedId: string | null;
  copiedTextIds: Set<string>;
  downloadingId: string | null;
  downloadFailedId: string | null;
  downloadedIds: Set<string>;
  downloadFailedIds: Set<string>;
  downloadProgressMap: Map<string, { percent: number; receivedSize: number; totalSize: number }>;
  onToggleShowAll: () => void;
  onClearAll: () => void;
  onCopyText: (text: string, id: string) => void;
  onDownloadFile: (filePath: string, fileName: string, itemId: string) => void;
}

// 根据文件扩展名获取文件类型
function getFileType(fileName: string): 'image' | 'video' | 'text' | 'file' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v'];
  const textExts = ['txt', 'md', 'json', 'xml', 'csv', 'log', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (textExts.includes(ext)) return 'text';
  return 'file';
}

// 文件类型图标组件
function FileTypeIcon({ fileName, direction }: { fileName: string; direction: 'sent' | 'received' }) {
  const fileType = getFileType(fileName);
  const colorClass = direction === 'received' ? 'text-success' : 'text-accent';

  return (
    <svg className={`w-5 h-5 flex-shrink-0 ${colorClass}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {fileType === 'image' && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </>
      )}
      {fileType === 'video' && (
        <>
          <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
          <polygon points="10 8 16 12 10 16 10 8" />
        </>
      )}
      {fileType === 'text' && (
        <>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </>
      )}
      {fileType === 'file' && (
        <>
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <polyline points="13 2 13 9 20 9" />
        </>
      )}
    </svg>
  );
}

export function HistoryList({
  history,
  showAllHistory,
  copiedId,
  copyFailedId,
  copiedTextIds,
  downloadingId,
  downloadFailedId,
  downloadedIds,
  downloadFailedIds,
  downloadProgressMap,
  onToggleShowAll,
  onClearAll,
  onCopyText,
  onDownloadFile
}: HistoryListProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  };

  const displayHistory = showAllHistory ? history : history.slice(0, 8);

  return (
    <aside className={`${showAllHistory ? 'fixed inset-0 z-40 bg-background' : 'flex-1 bg-secondary border-l border-border'} flex flex-col overflow-hidden`}>
      <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-bold">传输记录</h2>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button onClick={onClearAll} className="text-sm text-danger hover:text-danger/80 font-medium">
              清空
            </button>
          )}
          <button
            onClick={onToggleShowAll}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-hover transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {showAllHistory ? (
                <path d="M6 9l6 6 6-6" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar" id="historyContent">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-tertiary flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-muted">暂无记录</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {displayHistory.map((item) => {
              if (item.type === 'text') {
                const isCopied = copiedId === item.id;
                const isCopyFailed = copyFailedId === item.id;
                const hasBeenCopied = copiedTextIds.has(item.id);
                const showPending = !isCopied && !isCopyFailed && !hasBeenCopied;

                return (
                  <button
                    key={item.id}
                    onClick={() => onCopyText(item.content!, item.id)}
                    className="w-full p-3 rounded-xl text-left transition-colors relative bg-tertiary hover:bg-tertiary active:bg-tertiary focus:bg-tertiary focus:outline-none"
                  >
                    {/* 状态标签 - 右上角 */}
                    {showPending && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-muted px-1.5 py-0.5 bg-tertiary rounded">
                        待复制
                      </div>
                    )}
                    {isCopied && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-success px-1.5 py-0.5 bg-success/10 rounded">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        已复制
                      </div>
                    )}
                    {isCopyFailed && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-danger px-1.5 py-0.5 bg-danger/10 rounded">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        复制失败
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 flex-shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                      <div className="flex-1 min-w-0 pr-20">
                        <div className="flex items-center gap-2 text-xs text-muted mb-1.5">
                          {item.from && <span>{item.from}</span>}
                          {item.from && <span>·</span>}
                          <span>{formatTime(item.timestamp)}</span>
                        </div>
                        <div className="text-sm line-clamp-2 break-all">{item.content}</div>
                      </div>
                    </div>
                  </button>
                );
              } else {
                const isDownloaded = downloadedIds.has(item.id);
                const isDownloading = downloadingId === item.id;
                const isDownloadFailed = downloadFailedIds.has(item.id) || downloadFailedId === item.id;
                const isPending = !isDownloaded && !isDownloading && !isDownloadFailed;
                const downloadProgress = downloadProgressMap.get(item.id);

                return (
                  <button
                    key={item.id}
                    onClick={() => !isDownloaded && !isDownloadFailed && item.filePath && onDownloadFile(item.filePath, item.fileName!, item.id)}
                    disabled={isDownloaded || isDownloadFailed}
                    className={`w-full p-3 rounded-xl text-left transition-colors relative focus:outline-none ${isDownloaded || isDownloadFailed
                      ? 'bg-tertiary opacity-60 cursor-not-allowed'
                      : 'bg-tertiary hover:bg-tertiary active:bg-tertiary focus:bg-tertiary cursor-pointer'
                      }`}
                  >
                    {/* 状态标签 - 右上角 */}
                    {isPending && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-muted px-1.5 py-0.5 bg-tertiary rounded">
                        待下载
                      </div>
                    )}
                    {downloadingId === item.id && !downloadProgress && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-accent px-1.5 py-0.5 bg-accent/10 rounded">
                        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 12a9 9 0 11-6.219-8.56" />
                        </svg>
                        下载中
                      </div>
                    )}
                    {downloadProgress && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-accent px-1.5 py-0.5 bg-accent/10 rounded">
                        {downloadProgress.percent}%
                      </div>
                    )}
                    {isDownloadFailed && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-danger px-1.5 py-0.5 bg-danger/10 rounded">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        下载失败
                      </div>
                    )}
                    {isDownloaded && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] text-muted px-1.5 py-0.5 bg-tertiary rounded">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        已下载
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <FileTypeIcon fileName={item.fileName!} direction={item.direction} />
                      <div className="flex-1 min-w-0 pr-16">
                        <div className="text-sm font-medium truncate">{item.fileName}</div>
                        <div className="flex items-center gap-2 text-xs text-muted mt-1">
                          <span>{formatSize(item.fileSize!)}</span>
                          {item.from && (
                            <>
                              <span>·</span>
                              <span>{item.from}</span>
                            </>
                          )}
                          <span>·</span>
                          <span>{formatTime(item.timestamp)}</span>
                        </div>

                        {/* 下载进度条 */}
                        {downloadProgress && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[10px] text-muted mb-1">
                              <span>{formatSize(downloadProgress.receivedSize)} / {formatSize(downloadProgress.totalSize)}</span>
                            </div>
                            <div className="w-full h-1 bg-background rounded-full overflow-hidden">
                              <div
                                className="h-full bg-accent transition-all duration-300"
                                style={{ width: `${downloadProgress.percent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              }
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
