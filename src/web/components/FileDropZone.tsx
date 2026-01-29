interface FileItem {
  name: string;
  size: number;
  file: File;
}

interface TransferProgress {
  percent: number;
  currentFile: string;
  totalSize: number;
  sentSize?: number;
}

interface FileDropZoneProps {
  files: FileItem[];
  onFilesChange: (files: FileItem[]) => void;
  onSelectFiles: () => void;
  isDragging: boolean;
  isSending: boolean;
  sendProgress: TransferProgress | null;
}

export function FileDropZone({
  files,
  onFilesChange,
  onSelectFiles,
  isDragging,
  isSending,
  sendProgress
}: FileDropZoneProps) {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  const clearFiles = () => {
    onFilesChange([]);
  };

  return (
    <div className="space-y-4">
      {files.length === 0 ? (
        <div
          onClick={onSelectFiles}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${isDragging
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
        <div className="bg-secondary rounded-2xl p-4 space-y-3 min-h-[240px] flex flex-col">
          <div className="flex items-center justify-between">
            <span className="text-sm text-secondary">已选择 <span className="font-semibold">{files.length}</span> 个文件</span>
            <button onClick={clearFiles} className="text-sm text-danger hover:text-danger/80 font-medium">
              清空
            </button>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto">
            {files.map((fileItem, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-tertiary rounded-xl">
                <svg className="w-5 h-5 text-muted flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                  <path d="M13 2v7h7" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{fileItem.name}</div>
                  <div className="text-xs text-muted">{formatSize(fileItem.size)}</div>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="w-6 h-6 rounded-md flex items-center justify-center text-muted hover:bg-hover hover:text-danger transition-colors flex-shrink-0"
                >
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

      {isSending && sendProgress && (
        <div className="bg-secondary rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              发送中: {sendProgress.currentFile}
            </span>
            <span className="text-sm text-muted">{sendProgress.percent}%</span>
          </div>
          <div className="h-2 bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${sendProgress.percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
