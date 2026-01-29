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
}

export function DeviceList({ devices, selectedDevice, onSelectDevice }: DeviceListProps) {
  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted border-2 border-dashed border-border rounded-xl bg-secondary/30 fade-in">
        <svg className="w-10 h-10 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-sm font-medium">未发现设备</p>
        <p className="text-xs mt-1">请确保设备在同一网络</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      {devices.map(device => (
        <button
          key={device.id}
          onClick={() => onSelectDevice(device.id)}
          className={`p-3 rounded-lg border-2 transition-colors text-left ${selectedDevice === device.id
            ? 'border-accent bg-accent/5'
            : 'border-custom bg-secondary hover:bg-hover'
            }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selectedDevice === device.id ? 'bg-accent/20' : 'bg-tertiary'
              }`}>
              {device.type === 'pc' ? (
                <svg className={`w-4 h-4 ${selectedDevice === device.id ? 'text-accent' : 'text-muted'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              ) : (
                <svg className={`w-4 h-4 ${selectedDevice === device.id ? 'text-accent' : 'text-muted'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" />
                  <path d="M12 18h.01" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{device.name}</div>
            </div>
            {selectedDevice === device.id && (
              <svg className="w-4 h-4 text-accent flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
