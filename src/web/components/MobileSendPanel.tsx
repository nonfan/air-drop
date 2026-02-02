import { DeviceList } from '../../shared/components/DeviceList';

interface Device {
  id: string;
  name: string;
  model: string;
  ip: string;
  type: 'pc' | 'mobile';
}

interface FileItem {
  name: string;
  size: number;
  file: File;
}

interface MobileSendPanelProps {
  devices: Device[];
  selectedDevice: string | null;
  onSelectDevice: (id: string) => void;
  selectedFiles: FileItem[];
  text: string;
  onSelectFiles: () => void;
  onShowTextModal?: () => void;
  onClearFiles: () => void;
  onClearText: () => void;
  onSendToDevice: (deviceId: string) => void;
  isSending: boolean;
}

/**
 * 移动端发送面板组件
 * 包含快捷操作按钮、已选内容预览、设备选择
 */
export function MobileSendPanel({
  devices,
  selectedDevice,
  onSelectDevice,
  selectedFiles,
  text,
  onSelectFiles,
  onShowTextModal,
  onClearFiles,
  onClearText,
  onSendToDevice,
  isSending
}: MobileSendPanelProps) {
  const hasContent = selectedFiles.length > 0 || text.trim().length > 0;

  return (
    <div className="space-y-6">
      {/* 发送快捷操作 */}
      <div>
        <h2 className="text-sm font-medium mb-3">发送</h2>
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={onSelectFiles}
            className="flex flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                <path d="M13 2v7h7" />
              </svg>
            </div>
            <span className="text-xs text-foreground">文件</span>
          </button>

          <button
            onClick={onSelectFiles}
            className="flex flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </div>
            <span className="text-xs text-foreground">照片</span>
          </button>

          <button
            onClick={onShowTextModal}
            className="flex flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-pink-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <path d="M14 2v6h6M16 13H8m8 4H8m2-8H8" />
              </svg>
            </div>
            <span className="text-xs text-foreground">文本</span>
          </button>

          <button
            onClick={onSelectFiles}
            className="flex flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span className="text-xs text-foreground">文件夹</span>
          </button>
        </div>

        {/* 已选择内容预览 */}
        {hasContent && (
          <div className="mt-3 p-3 bg-secondary rounded-xl border border-divider">
            {selectedFiles.length > 0 ? (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
                  <path d="M13 2v7h7" />
                </svg>
                <span className="text-sm text-foreground truncate flex-1">
                  {selectedFiles.length === 1
                    ? selectedFiles[0].name
                    : `${selectedFiles.length} 个文件`}
                </span>
                <button
                  onClick={onClearFiles}
                  className="p-1 hover:bg-hover rounded transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-pink-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <path d="M14 2v6h6M16 13H8m8 4H8m2-8H8" />
                </svg>
                <span className="text-sm text-foreground truncate flex-1">{text}</span>
                <button
                  onClick={onClearText}
                  className="p-1 hover:bg-hover rounded transition-colors flex-shrink-0"
                >
                  <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 设备列表 */}
      <div>
        <h2 className="text-sm font-medium mb-3">
          选择设备
          {hasContent && devices.length > 0 && !isSending && (
            <span className="text-xs text-muted font-normal ml-1">(点击设备即可发送)</span>
          )}
        </h2>
        <DeviceList
          devices={devices}
          selectedDevice={selectedDevice}
          onSelectDevice={onSelectDevice}
          onSendToDevice={onSendToDevice}
          canSend={hasContent}
        />
      </div>
    </div>
  );
}
