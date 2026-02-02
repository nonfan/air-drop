import { HistoryItem, HistoryItemType } from './HistoryItem';

interface HistoryListProps {
  history: HistoryItemType[];
  showAllHistory: boolean;
  copiedId: string | null;
  copyFailedId: string | null;
  copiedTextIds: Set<string>;
  downloadingId: string | null;
  downloadFailedId: string | null;
  downloadedIds: Set<string>;
  downloadFailedIds: Set<string>;
  downloadProgressMap: Map<
    string,
    { percent: number; receivedSize: number; totalSize: number }
  >;
  downloadProgress?: { [key: string]: number }; // 新增：下载进度状态
  onToggleShowAll: () => void;
  onClearAll: () => void;
  onCopyText: (text: string, id: string) => void;
  onDownloadFile: (
    filePath: string,
    fileName: string,
    itemId: string
  ) => void;
  isMobile?: boolean; // 是否为移动端
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
  downloadProgress,
  onToggleShowAll,
  onClearAll,
  onCopyText,
  onDownloadFile,
  isMobile = false
}: HistoryListProps) {
  const displayHistory = showAllHistory ? history : history.slice(0, 8);

  return (
    <aside
      className={[
        showAllHistory
          ? 'fixed inset-0 z-40 bg-background'
          : 'flex-1 bg-secondary border-l border-border',
        'flex flex-col'
      ].join(' ')}
    >
      {/* ===== Header ===== */}
      <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <h2 className="text-base font-bold">传输记录</h2>

        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={onClearAll}
              className="text-sm text-danger hover:text-danger/80 font-medium"
            >
              清空
            </button>
          )}

          <button
            onClick={onToggleShowAll}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-hover transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {showAllHistory ? (
                <path d="M6 9l6 6 6-6" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* ===== Scroll Area ===== */}
      <div
        id="historyContent"
        className="flex-1 overflow-y-auto custom-scrollbar"
      >
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-16 h-16 rounded-full bg-tertiary flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-muted">暂无记录</p>
          </div>
        ) : (
          /* ⚠️ 关键：不要在这里加 relative / transform */
          <div className="p-4 space-y-2">
            {displayHistory.map((item) => (
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
                downloadProgress={downloadProgress}
                onCopyText={onCopyText}
                onDownloadFile={onDownloadFile}
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
