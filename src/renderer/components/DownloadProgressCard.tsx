import { formatSize } from '../utils';

interface DownloadProgressCardProps {
  fileName: string;
  fileSize: number;
  progress: number;
  receivedSize: number;
  onCancel?: () => void;
}

/**
 * 底部下载进度卡片
 * 显示正在下载的文件信息和进度
 */
export function DownloadProgressCard({
  fileName,
  fileSize,
  progress,
  receivedSize,
  onCancel
}: DownloadProgressCardProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-secondary border-t border-custom shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center gap-4">
          {/* 文件图标 */}
          <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
              <path d="M13 2v7h7" />
            </svg>
          </div>

          {/* 文件信息和进度 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-medium truncate pr-4">{fileName}</h3>
              <span className="text-sm text-muted flex-shrink-0">
                {formatSize(receivedSize)} / {formatSize(fileSize)}
              </span>
            </div>

            {/* 进度条 */}
            <div className="relative h-2 bg-tertiary rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted">正在下载...</span>
              <span className="text-xs font-medium text-accent">{progress}%</span>
            </div>
          </div>

          {/* 取消按钮 */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-lg hover:bg-tertiary transition-colors flex items-center justify-center flex-shrink-0"
              title="取消下载"
            >
              <svg className="w-5 h-5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
