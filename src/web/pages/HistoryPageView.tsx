import { HistoryView } from '../components';
import { useAppContext } from '../contexts/AppContext';

export function HistoryPageView() {
  const {
    history,
    copiedId,
    copyFailedId,
    copiedTextIds,
    downloadingId,
    downloadFailedId,
    downloadedIds,
    downloadFailedIds,
    downloadProgressMap,
    downloadProgressState,
    onCopyText,
    onDownloadFile,
    isMobile
  } = useAppContext();

  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <div className="w-full max-w-full mx-auto pb-4 md:pb-0">{/* 移动端添加底部 padding */}
        <HistoryView
          history={history}
          copiedId={copiedId}
          copyFailedId={copyFailedId}
          copiedTextIds={copiedTextIds}
          downloadingId={downloadingId}
          downloadFailedId={downloadFailedId}
          downloadedIds={downloadedIds}
          downloadFailedIds={downloadFailedIds}
          downloadProgressMap={downloadProgressMap}
          downloadProgress={downloadProgressState}
          onCopyText={onCopyText}
          onDownloadFile={onDownloadFile}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}
