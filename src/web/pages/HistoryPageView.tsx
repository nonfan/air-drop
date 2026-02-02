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
    onCopyText,
    onDownloadFile
  } = useAppContext();

  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <div className="w-full max-w-full mx-auto">
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
          onCopyText={onCopyText}
          onDownloadFile={onDownloadFile}
        />
      </div>
    </div>
  );
}
