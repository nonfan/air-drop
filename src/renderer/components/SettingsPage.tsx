import type { Settings } from '../types';

interface SettingsPageProps {
  settings: Settings | null;
  appVersion: string;
  updateStatus: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  updateInfo: { version?: string; percent?: number; error?: string };
  onSaveSettings: (settings: Partial<Settings>) => void;
  onCheckUpdate: () => void;
  onDownloadUpdate: () => void;
  onInstallUpdate: () => void;
}

export function SettingsPage({
  settings,
  appVersion,
  updateStatus,
  updateInfo,
  onSaveSettings,
  onCheckUpdate,
  onDownloadUpdate,
  onInstallUpdate
}: SettingsPageProps) {
  if (!settings) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-muted">加载中...</p>
        </div>
      </div>
    );
  }

  const handleSelectFolder = async () => {
    const path = await window.windrop.selectFolder();
    if (path) onSaveSettings({ downloadPath: path });
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">设置</h1>
          <p className="text-sm text-muted">配置应用偏好和行为</p>
        </div>

        <div className="bg-secondary rounded-2xl overflow-hidden divide-y divide-border">
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium mb-1">设备名称</div>
              <div className="text-xs text-muted">在局域网中显示的名称</div>
            </div>
            <input
              type="text"
              value={settings.deviceName}
              onChange={(e) => onSaveSettings({ deviceName: e.target.value })}
              className="w-48 px-3 py-2 bg-tertiary border border-custom rounded-lg text-sm outline-none focus:border-accent transition-all"
            />
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium mb-1">下载路径</div>
              <div className="text-xs text-muted truncate max-w-xs">{settings.downloadPath}</div>
            </div>
            <button onClick={handleSelectFolder} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-all">
              选择
            </button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium mb-1">自动接收</div>
              <div className="text-xs text-muted">自动接受文件传输请求</div>
            </div>
            <button
              onClick={() => onSaveSettings({ autoAccept: !settings.autoAccept })}
              className={`toggle ${settings.autoAccept ? 'on' : ''}`}
            >
              <div className="toggle-thumb"></div>
            </button>
          </div>

          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium mb-1">通知提醒</div>
              <div className="text-xs text-muted">接收文件时显示通知</div>
            </div>
            <button
              onClick={() => onSaveSettings({ showNotifications: !settings.showNotifications })}
              className={`toggle ${settings.showNotifications ? 'on' : ''}`}
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
              {(['system', 'dark', 'light'] as const).map(theme => (
                <button
                  key={theme}
                  onClick={() => onSaveSettings({ theme })}
                  className={`flex items-center justify-center w-9 h-8 rounded-md transition-all ${settings.theme === theme
                    ? 'bg-primary text-primary shadow-sm'
                    : 'text-muted hover:text-secondary'
                    }`}
                >
                  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {theme === 'system' && <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />}
                    {theme === 'dark' && <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />}
                    {theme === 'light' && (
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
              <div className="text-sm font-medium mb-1">应用更新</div>
              <div className="text-xs text-muted">当前版本 {appVersion}</div>
            </div>
            {updateStatus === 'idle' && (
              <button onClick={onCheckUpdate} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-all">
                检查更新
              </button>
            )}
            {updateStatus === 'checking' && (
              <div className="text-sm text-muted">检查中...</div>
            )}
            {updateStatus === 'available' && (
              <button onClick={onDownloadUpdate} className="px-4 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 transition-all">
                下载 {updateInfo.version}
              </button>
            )}
            {updateStatus === 'downloading' && (
              <div className="text-sm text-accent">下载中 {updateInfo.percent}%</div>
            )}
            {updateStatus === 'ready' && (
              <button onClick={onInstallUpdate} className="px-4 py-2 bg-success text-white rounded-lg text-sm font-medium hover:bg-success/90 transition-all">
                安装更新
              </button>
            )}
            {updateStatus === 'error' && (
              <div className="text-sm text-danger">更新失败</div>
            )}
          </div>
          {updateStatus === 'downloading' && updateInfo.percent !== undefined && (
            <div className="h-2 bg-tertiary rounded-full overflow-hidden">
              <div className="h-full bg-accent transition-all duration-300" style={{ width: `${updateInfo.percent}%` }} />
            </div>
          )}
        </div>

        <div className="text-center text-xs text-muted pt-4">
          <p>Airdrop - 简单快速的文件传输工具</p>
          <p className="mt-1">© 2024 All rights reserved</p>
        </div>
      </div>
    </div>
  );
}
