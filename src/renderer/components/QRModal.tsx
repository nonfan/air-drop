import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

interface QRModalProps {
  webURL: string;
  copiedId: string | null;
  onClose: () => void;
  onCopy: () => void;
}

export function QRModal({ webURL: initialURL, copiedId, onClose, onCopy }: QRModalProps) {
  const [webURL, setWebURL] = useState(initialURL);
  const [retryCount, setRetryCount] = useState(0);

  // 定期重新获取 URL，以防网络状态变化
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const url = await window.windrop.getWebURL();
        if (url && url !== webURL) {
          setWebURL(url);
          setRetryCount(0);
        }
      } catch (error) {
        console.error('Failed to refresh web URL:', error);
      }
    }, 2000); // 每2秒检查一次

    return () => clearInterval(interval);
  }, [webURL]);

  // 手动重试
  const handleRetry = async () => {
    setRetryCount(prev => prev + 1);
    try {
      const url = await window.windrop.getWebURL();
      setWebURL(url);
    } catch (error) {
      console.error('Failed to get web URL:', error);
    }
  };

  // 只有当 URL 明确是 localhost 或 127.0.0.1 时才显示错误
  const isLocalhost = Boolean(webURL && (webURL.includes('127.0.0.1') || webURL.includes('localhost')));
  const isLoading = !webURL;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bg-secondary border border-custom rounded-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold">扫码连接</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-hover transition-all">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 rounded-full border-4 border-accent/20 border-t-accent animate-spin mb-4"></div>
            <p className="text-sm text-muted mb-3">正在获取地址...</p>
            {retryCount > 0 && (
              <p className="text-xs text-muted">重试次数: {retryCount}</p>
            )}
          </div>
        ) : isLocalhost ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-3">
            <div className="flex items-start gap-2 mb-3">
              <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <div className="text-sm font-medium text-yellow-500 mb-1">无法获取局域网地址</div>
                <div className="text-xs text-yellow-500/80">
                  请确保电脑已连接到 Wi-Fi 或以太网。
                </div>
              </div>
            </div>
            <button
              onClick={handleRetry}
              className="w-full py-2 rounded-lg text-xs font-medium bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 transition-all"
            >
              重新获取地址
            </button>
          </div>
        ) : (
          <>
            <div className="bg-white p-3 rounded-xl mb-3 flex items-center justify-center w-fit mx-auto">
              <QRCodeSVG
                value={webURL}
                size={180}
                level="M"
                includeMargin={false}
              />
            </div>

            <div className="bg-tertiary rounded-lg p-2.5 mb-3">
              <div className="text-[10px] text-muted mb-1">访问地址</div>
              <div className="text-xs font-mono break-all">{webURL}</div>
            </div>
          </>
        )}

        <button
          onClick={onCopy}
          disabled={isLoading || isLocalhost}
          className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all ${isLoading || isLocalhost
            ? 'bg-tertiary text-muted cursor-not-allowed'
            : copiedId === 'url'
              ? 'bg-success text-white'
              : 'bg-accent text-white hover:bg-accent-hover'
            }`}
        >
          {copiedId === 'url' ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              已复制
            </span>
          ) : (
            isLoading ? '加载中...' : isLocalhost ? '无可用地址' : '复制链接'
          )}
        </button>

        {!isLoading && !isLocalhost && (
          <p className="text-[10px] text-muted text-center mt-3">
            使用手机浏览器扫描二维码或访问上方地址
          </p>
        )}
      </div>
    </div>
  );
}
