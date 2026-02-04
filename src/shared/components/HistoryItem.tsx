import { BadgeError } from './Badge';

export interface HistoryItemType {
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

interface HistoryItemProps {
  item: HistoryItemType;
  copiedId: string | null;
  copyFailedId: string | null;
  copiedTextIds: Set<string>;
  downloadingId: string | null;
  downloadFailedId: string | null;
  downloadedIds: Set<string>;
  downloadFailedIds: Set<string>;
  downloadProgressMap: Map<string, { percent: number; receivedSize: number; totalSize: number }>;
  downloadProgress?: { [key: string]: number }; // 新增：下载进度百分比
  onCopyText: (text: string, id: string) => void;
  onDownloadFile: (filePath: string, fileName: string, itemId: string) => void;
  compact?: boolean; // 紧凑模式，用于首页显示
  isMobile?: boolean; // 是否为移动端
}

// 根据文件扩展名获取文件类型（用于显示不同的文件图标）
function getFileType(fileName: string): 'image' | 'video' | 'text' | 'file' {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
  const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v'];
  const textExts = ['txt', 'md', 'json', 'xml', 'csv', 'log', 'js', 'ts', 'jsx', 'tsx', 'css', 'html', 'py', 'java', 'c', 'cpp', 'h'];

  if (imageExts.includes(ext)) return 'image';
  if (videoExts.includes(ext)) return 'video';
  if (textExts.includes(ext)) return 'text'; // 文本文件（.txt, .md 等）
  return 'file';
}

// 文件/消息类型图标组件（带圆形背景）
// 统一处理文本消息和文件传输的图标显示
function FileTypeIcon({
  type,
  fileName,
  direction
}: {
  type: 'text' | 'file';
  fileName?: string;
  direction: 'sent' | 'received'
}) {
  const colorClass = direction === 'received' ? 'text-success' : 'text-accent';

  // 使用 rgba 来实现 10% 透明度的背景
  const bgStyle = type === 'text'
    ? { backgroundColor: 'rgba(236, 72, 153, 0.1)' } // accent with 10% opacity
    : direction === 'received'
      ? { backgroundColor: 'rgba(34, 197, 94, 0.1)' } // success with 10% opacity
      : { backgroundColor: 'rgba(59, 130, 246, 0.1)' }; // accent with 10% opacity

  // 文本消息：显示聊天气泡图标
  if (type === 'text') {
    return (
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={bgStyle}
      >
        <svg className={`w-5 h-5 flex-shrink-0 ${colorClass}`} viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        </svg>
      </div>
    );
  }

  // 文件传输：根据文件扩展名显示不同图标
  const fileType = getFileType(fileName || '');

  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={bgStyle}
    >
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
    </div>
  );
}

// 格式化文件大小
function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

/**
 * 历史记录单条组件
 * 支持文本消息和文件传输
 * 可用于历史记录列表和首页预览
 */
export function HistoryItem({
  item,
  copiedId,
  copyFailedId,
  copiedTextIds: _copiedTextIds,
  downloadingId,
  downloadFailedId,
  downloadedIds: _downloadedIds,
  downloadFailedIds,
  downloadProgressMap,
  downloadProgress,
  onCopyText,
  onDownloadFile,
  compact = false,
  isMobile: _isMobile = false
}: HistoryItemProps) {
  // 文本消息的状态
  const isCopied = copiedId === item.id;
  const isCopyFailed = copyFailedId === item.id;

  // 文件消息的状态
  const isDownloading = downloadingId === item.id;
  const isDownloadFailed = downloadFailedIds.has(item.id) || downloadFailedId === item.id;
  const currentDownloadProgress = downloadProgress?.[item.id] || downloadProgressMap.get(item.id)?.percent || 0;

  // 判断是否禁用
  const isDisabled = item.type === 'text' ? isCopyFailed : isDownloadFailed;

  // 点击处理
  const handleClick = () => {
    if (isDisabled) return;

    if (item.type === 'text') {
      onCopyText(item.content!, item.id);
    } else {
      if (item.filePath) {
        onDownloadFile(item.filePath, item.fileName!, item.id);
      }
    }
  };

  return (
    <div className="w-full">
      <div
        className={`relative flex group w-full gap-2 p-3 rounded-xl transition-all
          ${isDisabled
            ? 'bg-tertiary opacity-60 cursor-not-allowed'
            : 'bg-tertiary hover:bg-white/[0.05] active:scale-[0.98] cursor-pointer'
          }`}
        onClick={handleClick}
      >
        {/* 右上角状态图标/标签 */}
        <div
          className="absolute z-10 pointer-events-none transition-all duration-300"
          style={{
            top: '12px',
            right: '12px'
          }}
        >
          {item.type === 'text' ? (
            // 文本消息：复制图标
            isCopyFailed ? (
              <BadgeError text="复制失败" />
            ) : isCopied ? (
              <svg
                className="w-5 h-5 text-success animate-scale-in"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              null
            )
          ) : (
            // 文件消息：下载状态标签
            <>
              {isDownloading && (
                <div className="px-2 py-1 bg-accent/10 text-accent text-xs font-medium rounded">
                  下载中
                </div>
              )}
              {isDownloadFailed && <BadgeError text="文件不存在" />}
            </>
          )}
        </div>

        {/* 左侧图标 */}
        <div className='flex-shrink-0 mr-3'>
          <FileTypeIcon
            type={item.type}
            fileName={item.fileName}
            direction={item.direction}
          />
        </div>

        {/* 右侧内容区域 */}
        <div className={`flex-1 min-w-0 ${isDisabled ? 'pr-20' : 'pr-10'} flex flex-col`}>
          {/* 设备信息和时间 */}
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <span>{item.from || '未知设备'}</span>
            <span>·</span>
            <span>{formatTime(item.timestamp)}</span>
          </div>

          {/* 内容 */}
          {item.type === 'text' ? (
            <div className="text-sm break-all line-clamp-2">
              {item.content}
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-medium truncate">
                {item.fileName}
              </span>
              <span className="text-xs text-muted flex-shrink-0">
                ({formatSize(item.fileSize!)})
              </span>
            </div>
          )}

          {/* 下载进度条 - 放在卡片底部 */}
          {item.type === 'file' && isDownloading && currentDownloadProgress > 0 && !compact && (
            <div className="mt-auto pt-2">
              <div className="flex items-center justify-between text-xs text-muted mb-1.5">
                <span>接收中...</span>
                <span className="font-medium">{currentDownloadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${currentDownloadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
