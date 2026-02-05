import type { Device, FileItem, SharedFile, TransferProgress } from '../types';

interface FileDropZoneProps {
  isDragging: boolean;
  selectedFiles: FileItem[];
  sharedFiles: SharedFile[];
  isSending: boolean;
  isDownloading: boolean;
  sendProgress: TransferProgress | null;
  receiveProgress: TransferProgress | null;
  devices: Device[];
  downloadProgressMap: Map<string, { percent: number; receivedSize: number; totalSize: number }>;
  transferHistory: any[]; // 历史记录，用于匹配文件名
  onSelectFiles: () => void;
  onRemoveFile: (index: number) => void;
  onClearFiles: () => void;
  onRemoveSharedFile: (id: string) => void;
  formatSize: (bytes: number) => string;
}

export function FileDropZone({
  isDragging,
  selectedFiles,
  sharedFiles,
  isSending,
  isDownloading,
  sendProgress,
  receiveProgress,
  devices,
  downloadProgressMap,
  transferHistory,
  onSelectFiles,
  onRemoveFile,
  onClearFiles,
  onRemoveSharedFile,
  formatSize
}: FileDropZoneProps) {
  // 检查是否有移动端正在下载的文件
  // 通过文件名匹配 sharedFiles 和 downloadProgressMap
  const mobileDownloadProgress = sharedFiles
    .map(file => {
      // 在历史记录中查找匹配的文件名
      const matchingRecord = transferHistory.find(record =>
        record.fileName === file.name && record.type === 'sent'
      );

      if (matchingRecord) {
        const progress = downloadProgressMap.get(matchingRecord.id);
        if (progress && progress.percent >= 0 && progress.percent < 100) {
          return {
            fileId: file.id,
            fileName: file.name,
            targetId: file.targetId,
            ...progress
          };
        }
      }
      return null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  console.log('[FileDropZone] Mobile download progress:', {
    sharedFilesCount: sharedFiles.length,
    progressCount: mobileDownloadProgress.length,
    downloadProgressMapSize: downloadProgressMap.size,
    sharedFiles: sharedFiles.map(f => ({ id: f.id, name: f.name, targetId: f.targetId })),
    mobileDownloadProgress
  });
  return (
    <div className="space-y-4">
      {/* 移动端下载进度 */}
      {mobileDownloadProgress.length > 0 && mobileDownloadProgress.map((progress) => {
        const device = devices.find(d => d.id === progress.targetId);

        return (
          <div key={progress.fileId} className="bg-secondary rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {device?.name || '移动端'} 下载中: {progress.fileName}
              </span>
              <span className="text-sm text-muted">{progress.percent}%</span>
            </div>
            <div className="h-2 bg-tertiary rounded-full overflow-hidden">
              <div
                className="h-full bg-success transition-all duration-300"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        );
      })}

      {/* 文件拖放区 / 已选文件列表 */}
      {selectedFiles.length === 0 && sharedFiles.length === 0 ? (
        <div
          onClick={onSelectFiles}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${isDragging
            ? 'border-accent bg-accent/5'
            : 'border-custom bg-secondary hover:bg-hover'
            }`}
        >
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-accent/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
            </svg>
          </div>
          <div className="text-base font-semibold mb-2">点击或拖放文件</div>
          <div className="text-sm text-muted">支持多选和粘贴</div>
        </div>
      ) : (
        <div className="bg-secondary rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary">
              {sharedFiles.length > 0 ? '等待下载' : '已选择'} <span className="font-semibold">{sharedFiles.length + selectedFiles.length}</span> 个文件
            </span>
            <button onClick={onClearFiles} className="text-sm text-danger hover:text-danger/80 font-medium">
              清空
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
            {/* 等待下载的文件 */}
            {sharedFiles.map(file => {
              const device = devices.find(d => d.id === file.targetId);
              return (
                <div key={`shared-${file.id}`} className="flex items-center gap-3 p-3 bg-tertiary rounded-xl">
                  <svg className="w-5 h-5 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                    <path d="M13 2v7h7" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted">已发送 · 等待 {device?.name || '未知设备'} 下载</div>
                  </div>
                  <button onClick={() => onRemoveSharedFile(file.id)} className="w-6 h-6 rounded-md flex items-center justify-center text-muted hover:bg-hover hover:text-danger transition-all flex-shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}

            {/* 已选择的文件 */}
            {selectedFiles.map((file, i) => (
              <div key={`selected-${i}`} className="flex items-center gap-3 p-3 bg-tertiary rounded-xl">
                <svg className="w-5 h-5 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                  <path d="M13 2v7h7" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-muted">{formatSize(file.size)}</div>
                </div>
                <button onClick={() => onRemoveFile(i)} className="w-6 h-6 rounded-md flex items-center justify-center text-muted hover:bg-hover hover:text-danger transition-all flex-shrink-0">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <button onClick={onSelectFiles} className="w-full py-2 text-sm text-accent hover:text-accent-hover font-medium">
            + 添加更多
          </button>
        </div>
      )}
    </div>
  );
}
