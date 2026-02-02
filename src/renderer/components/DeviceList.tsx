import type { Device, FileItem } from '../types';

interface DeviceListProps {
  devices: Device[];
  selectedDevice: string | null;
  onSelectDevice: (id: string) => void;
  sendMode: 'file' | 'text';
  selectedFiles: FileItem[];
  textInput: string;
  isSending: boolean;
  onSend: (deviceId?: string) => void; // 添加可选的 deviceId 参数
  onSendText: (deviceId?: string) => void; // 添加可选的 deviceId 参数
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
    ? selectedFiles.length > 0
    : textInput.trim().length > 0;

  const handleDeviceClick = (deviceId: string) => {
    // 如果没有内容或正在发送，不允许点击
    if (!canSend || isSending) {
      return;
    }

    // 先更新选中的设备
    onSelectDevice(deviceId);

    // 直接发送到指定设备，不依赖状态更新
    if (sendMode === 'file') {
      onSend(deviceId);
    } else {
      onSendText(deviceId);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">选择设备</h2>
        <button onClick={onShowQR} className="text-xs text-accent hover:text-accent-hover font-medium transition-colors">
          扫码连接
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="bg-secondary rounded-xl p-6 text-center border border-custom">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-tertiary flex items-center justify-center">
            <svg className="w-6 h-6 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-muted text-xs font-medium">未发现设备</p>
          <p className="text-muted text-[10px] mt-1">请确保设备在同一网络</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {devices.map(device => (
            <button
              key={device.id}
              onClick={() => handleDeviceClick(device.id)}
              disabled={!canSend || isSending}
              className={`p-3 rounded-lg border transition-all text-left group ${!canSend || isSending
                ? 'opacity-50 cursor-not-allowed border-custom bg-secondary'
                : selectedDevice === device.id
                  ? 'border-accent bg-accent/5'
                  : 'border-custom bg-secondary hover:bg-hover hover:border-accent/50'
                } ${canSend && !isSending ? 'active:scale-[0.98] cursor-pointer' : ''}`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${!canSend || isSending ? 'bg-tertiary' : selectedDevice === device.id ? 'bg-accent/20' : 'bg-tertiary group-hover:bg-accent/10'
                  }`}>
                  <svg className={`w-4 h-4 transition-colors ${!canSend || isSending ? 'text-muted' : selectedDevice === device.id ? 'text-accent' : 'text-muted group-hover:text-accent'
                    }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                  <div className="font-medium text-xs truncate">{device.name}</div>
                  <div className="text-[10px] text-muted truncate mt-0.5">{device.ip}</div>
                </div>
                {canSend && !isSending ? (
                  <svg className={`w-4 h-4 flex-shrink-0 transition-colors ${selectedDevice === device.id ? 'text-accent' : 'text-muted group-hover:text-accent'
                    }`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 19V5M5 12l7-7 7 7" />
                  </svg>
                ) : selectedDevice === device.id && canSend ? (
                  <svg className="w-4 h-4 text-accent flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 提示文本 */}
      {canSend && devices.length > 0 && !isSending && (
        <p className="text-[10px] text-muted text-center animate-pulse">
          点击设备即可发送
        </p>
      )}
    </div>
  );
}
