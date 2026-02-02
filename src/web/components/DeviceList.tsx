interface Device {
  id: string;
  name: string;
  model: string;
  ip: string;
  type: 'pc' | 'mobile';
}

interface DeviceListProps {
  devices: Device[];
  selectedDevice: string | null;
  onSelectDevice: (id: string) => void;
  onSendToDevice?: (deviceId: string) => void;
  canSend?: boolean;
}

export function DeviceList({
  devices,
  selectedDevice,
  onSelectDevice,
  onSendToDevice,
  canSend = false
}: DeviceListProps) {
  const handleDeviceClick = (deviceId: string) => {
    // 如果没有内容，不允许点击
    if (!canSend) {
      return;
    }

    if (onSendToDevice) {
      // 点击直接发送
      onSendToDevice(deviceId);
    } else {
      // 只是选择设备
      onSelectDevice(deviceId);
    }
  };

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted border-2 border-dashed border-border rounded-lg bg-secondary/30 fade-in">
        <svg className="w-8 h-8 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-xs font-medium">未发现设备</p>
        <p className="text-[10px] mt-1 opacity-70">请确保设备在同一网络</p>
        {/iPhone|iPad|iPod/.test(navigator.userAgent) && (
          <div className="mt-3 p-2 bg-accent/10 border border-accent/30 rounded-lg hidden md:block">
            <p className="text-[10px] text-accent text-center">
              💡 iOS 无法自动发现设备<br />
              请在桌面端扫描二维码连接
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {devices.map(device => (
        <button
          key={device.id}
          onClick={() => handleDeviceClick(device.id)}
          disabled={!canSend}
          className={`transition-all group flex flex-col items-center gap-2 ${!canSend
            ? 'opacity-50 cursor-not-allowed'
            : ''
            } ${canSend && onSendToDevice ? 'active:scale-95' : ''}`}
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${!canSend
            ? device.type === 'pc' ? 'bg-green-500/10' : 'bg-blue-500/10'
            : selectedDevice === device.id
              ? device.type === 'pc' ? 'bg-green-500/20' : 'bg-blue-500/20'
              : device.type === 'pc' ? 'bg-green-500/10 group-hover:bg-green-500/20' : 'bg-blue-500/10 group-hover:bg-blue-500/20'
            }`}>
            {device.type === 'pc' ? (
              <svg className="w-7 h-7 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="2" width="14" height="20" rx="2" />
                <path d="M12 18h.01" />
              </svg>
            )}
          </div>
          <div className="text-center w-full">
            <div className="text-xs font-medium truncate">{device.name}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
