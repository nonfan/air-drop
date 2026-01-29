import type { Device, FileItem } from '../types';

interface DeviceListProps {
  devices: Device[];
  selectedDevice: string | null;
  onSelectDevice: (id: string) => void;
  sendMode: 'file' | 'text';
  selectedFiles: FileItem[];
  textInput: string;
  isSending: boolean;
  onSend: () => void;
  onSendText: () => void;
  onShowQR: () => void;
}

export function DeviceList({
  devices,
  selectedDevice,
  onSelectDevice,
  sendMode,
  selectedFiles,
  textInput,
  isSending,
  onSend,
  onSendText,
  onShowQR
}: DeviceListProps) {
  const canSend = sendMode === 'file'
    ? selectedFiles.length > 0 && selectedDevice
    : textInput.trim() && selectedDevice;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">选择设备</h2>
        <button onClick={onShowQR} className="text-sm text-accent hover:text-accent-hover font-medium">
          扫码连接
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="bg-secondary rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-tertiary flex items-center justify-center">
            <svg className="w-8 h-8 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-muted text-sm">未发现设备</p>
          <p className="text-muted text-xs mt-1">请确保设备在同一网络</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {devices.map(device => (
            <button
              key={device.id}
              onClick={() => onSelectDevice(device.id)}
              className={`p-4 rounded-xl border transition-all text-left ${selectedDevice === device.id
                  ? 'border-accent bg-accent/5'
                  : 'border-custom bg-secondary hover:bg-hover'
                }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedDevice === device.id ? 'bg-accent/20' : 'bg-tertiary'
                  }`}>
                  <svg className={`w-5 h-5 ${selectedDevice === device.id ? 'text-accent' : 'text-muted'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {device.type === 'mobile' ? (
                      <>
                        <rect x="5" y="2" width="14" height="20" rx="2" />
                        <path d="M12 18h.01" />
                      </>
                    ) : (
                      <>
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                      </>
                    )}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{device.name}</div>
                  <div className="text-xs text-muted truncate">{device.ip}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={sendMode === 'file' ? onSend : onSendText}
        disabled={!canSend || isSending}
        className="w-full py-3 px-5 bg-accent text-white rounded-xl font-medium hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {isSending ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
            </svg>
            发送中...
          </>
        ) : (
          <>
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            {sendMode === 'file' ? `发送 ${selectedFiles.length} 个文件` : '发送文本'}
          </>
        )}
      </button>
    </div>
  );
}
