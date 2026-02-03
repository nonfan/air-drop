/**
 * 文件接收提示组件
 * 显示文件接收通知，带下载按钮
 */
import { useEffect, useState } from 'react';

interface FileReceivedToastProps {
  fileName: string;
  fileSize: number;
  from: string;
  onDownload: () => void;
  onDismiss: () => void;
}

export function FileReceivedToast({
  fileName,
  fileSize,
  from,
  onDownload,
  onDismiss
}: FileReceivedToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  // 格式化文件大小
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  // 10秒后自动消失
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onDismiss, 300); // 等待动画完成
    }, 10000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDownload = () => {
    onDownload();
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
        }`}
      style={{ maxWidth: 'calc(100vw - 2rem)' }}
    >
      <div className="bg-secondary border border-border rounded-xl shadow-lg p-4 min-w-[320px]">
        <div className="flex items-start gap-3">
          {/* 文件图标 */}
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5 text-success"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
              <path d="M13 2v7h7" />
            </svg>
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-foreground">收到文件</p>
              <button
                onClick={handleDismiss}
                className="text-muted hover:text-foreground transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm text-foreground truncate mb-1">{fileName}</p>
            <p className="text-xs text-muted">
              {formatSize(fileSize)} · 来自 {from}
            </p>
          </div>
        </div>

        {/* 下载按钮 */}
        <button
          onClick={handleDownload}
          className="w-full mt-3 py-2 px-4 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors active:scale-95"
        >
          立即下载
        </button>
      </div>
    </div>
  );
}
