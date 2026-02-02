import { EmptyState } from '../common/EmptyState';
import { HistoryItem as HistoryItemComponent, type HistoryItemType } from '../../../shared/components/HistoryItem';

interface HistoryViewProps {
  history: HistoryItemType[];
  copiedId: string | null;
  copyFailedId: string | null;
  copiedTextIds: Set<string>;
  downloadingId: string | null;
  downloadFailedId: string | null;
  downloadedIds: Set<string>;
  downloadFailedIds: Set<string>;
  downloadProgressMap: Map<string, { percent: number; receivedSize: number; totalSize: number }>;
  downloadProgress?: { [key: string]: number };
  onCopyText: (text: string, id: string) => void;
  onDownloadFile: (filePath: string, fileName: string, itemId: string) => void;
  isMobile?: boolean;
}

/**
 * 历史记录视图组件
 * 显示传输历史记录列表
 */
export function HistoryView({
  history,
  copiedId,
  copyFailedId,
  copiedTextIds,
  downloadingId,
  downloadFailedId,
  downloadedIds,
  downloadFailedIds,
  downloadProgressMap,
  downloadProgress,
  onCopyText,
  onDownloadFile,
  isMobile = false
}: HistoryViewProps) {
  if (history.length === 0) {
    return (
      <EmptyState
        icon={
          <svg className="w-8 h-8 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        message="暂无记录"
      />
    );
  }

  return (
    <div className="space-y-3">
      {history.map((item) => (
        <HistoryItemComponent
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
          compact={false}
          isMobile={isMobile}
        />
      ))}
    </div>
  );
}
