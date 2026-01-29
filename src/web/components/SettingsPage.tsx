import { useState } from 'react';

type Theme = 'system' | 'dark' | 'light';

interface Settings {
  deviceName: string;
  theme: Theme;
  showNotifications: boolean;
}

interface SettingsPageProps {
  settings: Settings;
  onSaveSettings: (settings: Partial<Settings>) => void;
}

export function SettingsPage({ settings, onSaveSettings }: SettingsPageProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(settings.deviceName);

  const handleSaveName = () => {
    if (tempName.trim()) {
      onSaveSettings({ deviceName: tempName.trim() });
      setIsEditingName(false);
    } else {
      setTempName(settings.deviceName);
      setIsEditingName(false);
    }
  };

  const handleBlur = () => {
    handleSaveName();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setTempName(settings.deviceName);
      setIsEditingName(false);
    }
  };

  const handleRequestNotification = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        onSaveSettings({ showNotifications: true });
        new Notification('通知已启用', {
          body: '你将收到文件传输通知',
          icon: '/icon.png'
        });
      }
    }
  };

  const notificationStatus = 'Notification' in window
    ? Notification.permission
    : 'unsupported';

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6 fade-in">
        <div>
          <h1 className="text-2xl font-bold mb-1">设置</h1>
          <p className="text-sm text-muted">配置应用偏好和行为</p>
        </div>

        <div className="bg-secondary rounded-2xl overflow-hidden divide-y divide-border shadow-lg">
          <div className="setting-item">
            <div>
              <div className="text-sm font-medium mb-1">设备名称</div>
              <div className="text-xs text-muted">在局域网中显示的名称</div>
            </div>
            {isEditingName ? (
              <input
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="input w-48"
                autoFocus
                placeholder="输入设备名称"
              />
            ) : (
              <div
                onClick={() => {
                  setIsEditingName(true);
                  setTempName(settings.deviceName);
                }}
                className="text-sm font-medium cursor-pointer hover:text-accent transition-colors px-3 py-2 rounded-lg hover:bg-tertiary"
              >
                {settings.deviceName}
              </div>
            )}
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium mb-1">通知提醒</div>
              <div className="text-xs text-muted">接收文件时显示通知</div>
            </div>
            <button
              onClick={() => {
                if (notificationStatus === 'default') {
                  handleRequestNotification();
                } else if (notificationStatus === 'granted') {
                  onSaveSettings({ showNotifications: !settings.showNotifications });
                }
              }}
              disabled={notificationStatus === 'denied' || notificationStatus === 'unsupported'}
              className={`toggle ${settings.showNotifications && notificationStatus === 'granted' ? 'on' : ''} ${notificationStatus === 'denied' || notificationStatus === 'unsupported' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
            >
              <div className="toggle-thumb"></div>
            </button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium mb-1">主题</div>
              <div className="text-xs text-muted">选择应用外观</div>
            </div>
            <div className="flex bg-tertiary border border-custom rounded-lg p-0.5 gap-0.5">
              {(['system', 'dark', 'light'] as const).map(themeOption => (
                <button
                  key={themeOption}
                  onClick={() => onSaveSettings({ theme: themeOption })}
                  className={`flex items-center justify-center w-9 h-8 rounded-md transition-all ${settings.theme === themeOption
                    ? 'bg-primary text-primary shadow-sm'
                    : 'text-muted hover:text-secondary'
                    }`}
                >
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {themeOption === 'system' && (
                      <>
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8M12 17v4" />
                      </>
                    )}
                    {themeOption === 'dark' && <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />}
                    {themeOption === 'light' && (
                      <>
                        <circle cx="12" cy="12" r="5" />
                        <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                      </>
                    )}
                  </svg>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-secondary rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm font-medium mb-1">连接信息</div>
              <div className="text-xs text-muted">当前连接状态</div>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">服务器地址</span>
              <span className="font-mono text-xs">{window.location.host}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">连接状态</span>
              <span className="text-success">已连接</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">协议</span>
              <span>WebSocket</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">平台</span>
              <span>{navigator.userAgent.includes('Mobile') ? '移动设备' : '桌面浏览器'}</span>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-muted pt-4">
          <p>Airdrop - 简单快速的文件传输工具</p>
          <p className="mt-1">© 2024 All rights reserved · Web Client v2.0.0</p>
        </div>
      </div>
    </div>
  );
}
