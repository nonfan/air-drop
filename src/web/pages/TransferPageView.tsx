import { TransferPage } from '../components';
import { useAppContext } from '../contexts/AppContext';

export function TransferPageView() {
  const {
    mode,
    setMode,
    devices,
    selectedDevice,
    onSelectDevice,
    selectedFiles,
    onFilesChange,
    onSelectFiles,
    text,
    onTextChange,
    isDragging,
    isSending,
    sendProgress,
    downloadProgress,
    onSend,
    history,
    showAllHistory,
    onToggleShowAll,
    onClearHistory,
    copiedId,
    copyFailedId,
    copiedTextIds,
    downloadingId,
    downloadFailedId,
    downloadedIds,
    downloadFailedIds,
    downloadProgressMap,
    onCopyText,
    onDownloadFile,
    onShowTextModal,
    isMobile,
    isRefreshing,
    onRefreshDevices
  } = useAppContext();

  return (
    <TransferPage
      mode={mode}
      onModeChange={setMode}
      devices={devices}
      selectedDevice={selectedDevice}
      onSelectDevice={onSelectDevice}
      selectedFiles={selectedFiles}
      onFilesChange={onFilesChange}
      onSelectFiles={onSelectFiles}
      text={text}
      onTextChange={onTextChange}
      isDragging={isDragging}
      isSending={isSending}
      sendProgress={sendProgress}
      downloadProgress={downloadProgress}
      onSend={onSend}
      history={history}
      showAllHistory={showAllHistory}
      onToggleShowAll={onToggleShowAll}
      onClearHistory={onClearHistory}
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
      onShowTextModal={onShowTextModal}
      isMobile={isMobile}
      isRefreshing={isRefreshing}
      onRefreshDevices={onRefreshDevices}
    />
  );
}
