import type { TransferRecord, ReceivedText } from '../types';

interface HistoryListProps {
  transferHistory: TransferRecord[];
  receivedTexts: ReceivedText[];
  showAllHistory: boolean;
  copiedId: string | null;
  openedId: string | null;
  missingFiles: Set<string>;
  onToggleShowAll: () => void;
  onClearAll: () => void;
  onCopyText: (text: string, id: string) => void;
  onOpenFile: (filePath: string, id: string) => void;
  formatSize: (bytes: number) => string;
  formatTime: (timestamp: number) => string;
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
function FileTypeIcon({ fileName, type }: { fileName: string; type: 'received' | 'sent' }) {
  const fileType = getFileType(fileName);
  const colorClass = type === 'received' ? 'text-success' : 'text-accent';

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
  transferHistory,
  receivedTexts,
  showAllHistory,
  copiedId,
  openedId,
  missingFiles,
  onToggleShowAll,
  onClearAll,
  onCopyText,
  onOpenFile,
  formatSize,
  formatTime
}: HistoryListProps) {
  // 合并文本和文件记录，按时间排序
  const allRecords = [
    ...receivedTexts.map(text => ({ ...text, recordType: 'text' as const })),
    ...transferHistory.map(file => ({ ...file, recordType: 'file' as const }))
  ].sort((a, b) => b.timestamp - a.timestamp);

  const displayRecords = showAllHistory ? allRecords : allRecords.slice(0, 8);

  return (
    <aside className={`${showAllHistory ? 'fixed inset-0 z-40 bg-primary' : 'w-[400px] flex-shrink-0 bg-secondary border-l border-custom'} flex flex-col overflow-hidden`}>
      <div className="p-4 border-b border-custom flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-bold">传输记录</h2>
        <div className="flex items-center gap-2">
          {allRecords.length > 0 && (
            <button onClick={onClearAll} className="text-sm text-danger hover:text-danger/80 font-medium">
              清空
            </button>
          )}
          <button
            onClick={onToggleShowAll}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-hover transition-all"
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
        {allRecords.length === 0 ? (
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
            {displayRecords.map((record) => {
              if (record.recordType === 'text') {
                const textRecord = record as ReceivedText & { recordType: 'text' };
                return (
                  <button
                    key={`text-${textRecord.id}`}
                    onClick={() => onCopyText(textRecord.text, textRecord.id)}
                    className={`w-full p-3 rounded-xl text-left transition-all relative border border-transparent bg-tertiary hover:bg-hover`}
                  >
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 flex-shrink-0 text-accent mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <span>{textRecord.from}</span>
                            <span>·</span>
                            <span>{formatTime(textRecord.timestamp)}</span>
                          </div>
                          {copiedId === textRecord.id && (
                            <div className="flex items-center gap-0.5 text-[10px] text-success px-1.5 py-0.5 bg-success/10 rounded flex-shrink-0">
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              已复制
                            </div>
                          )}
                        </div>
                        <div className="text-sm line-clamp-2 break-all">{textRecord.text}</div>
                      </div>
                    </div>
                  </button>
                );
              } else {
                const fileRecord = record as TransferRecord & { recordType: 'file' };
                return (
                  <button
                    key={`file-${fileRecord.id}`}
                    onClick={() => onOpenFile(fileRecord.filePath, fileRecord.id)}
                    disabled={missingFiles.has(fileRecord.id)}
                    className={`w-full p-3 rounded-xl text-left transition-all relative border border-transparent ${missingFiles.has(fileRecord.id)
                      ? 'opacity-50 cursor-not-allowed bg-tertiary'
                      : 'bg-tertiary hover:bg-hover'
                      }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <FileTypeIcon fileName={fileRecord.fileName} type={fileRecord.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
                            <span className="truncate">{fileRecord.from}</span>
                            <span className="flex-shrink-0">·</span>
                            <span className="flex-shrink-0">{formatTime(fileRecord.timestamp)}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {missingFiles.has(fileRecord.id) && (
                              <div className="text-[10px] text-danger px-1.5 py-0.5 bg-danger/10 rounded">
                                文件已删除
                              </div>
                            )}
                            {openedId === fileRecord.id && !missingFiles.has(fileRecord.id) && (
                              <div className="flex items-center gap-0.5 text-[10px] text-success px-1.5 py-0.5 bg-success/10 rounded">
                                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                                已打开
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-sm font-medium truncate flex-1">{fileRecord.fileName}</div>
                          <div className="text-xs text-muted flex-shrink-0">{formatSize(fileRecord.size)}</div>
                        </div>
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
