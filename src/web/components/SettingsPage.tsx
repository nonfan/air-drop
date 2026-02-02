import { useState } from 'react';
import { Footer } from './common/Footer';

type Theme = 'system' | 'dark' | 'light';
type AccentColor = 'blue' | 'green' | 'purple' | 'pink' | 'orange';

interface Settings {
  deviceName: string;
  theme: Theme;
  showNotifications: boolean;
  discoverable: boolean;
  accentColor: AccentColor;
}

interface SettingsPageProps {
  settings: Settings;
  onSaveSettings: (settings: Partial<Settings>) => void;
}

export function SettingsPage({ settings, onSaveSettings }: SettingsPageProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(settings.deviceName);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showAccentMenu, setShowAccentMenu] = useState(false);

  // 检测是否为移动设备
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // 主题色配置
  const accentColors = [
    { id: 'blue' as AccentColor, name: '蓝色', color: '#3b82f6' },
    { id: 'green' as AccentColor, name: '绿色', color: '#22c55e' },
    { id: 'purple' as AccentColor, name: '紫色', color: '#a855f7' },
    { id: 'pink' as AccentColor, name: '粉色', color: '#ec4899' },
    { id: 'orange' as AccentColor, name: '橙色', color: '#f97316' }
  ];

  const currentAccentColor = accentColors.find(c => c.id === settings.accentColor) || accentColors[0];

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

  const handleThemeChange = (theme: Theme) => {
    onSaveSettings({ theme });
    setShowThemeMenu(false);
  };

  const handleAccentColorChange = (color: AccentColor) => {
    onSaveSettings({ accentColor: color });
    setShowAccentMenu(false);
  };

  return (
    <div className="w-full h-full overflow-y-auto bg-background pb-20">
      <div className="px-6 py-4 space-y-6">
        {/* 用户信息卡片 */}
        <div className="bg-secondary rounded-2xl p-5">
          <div className="flex items-center gap-4">
            {/* 头像 */}
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(settings.deviceName)}`}
              alt="Avatar"
              className="w-16 h-16 rounded-full bg-tertiary flex-shrink-0"
            />
            {/* 设备名称 */}
            <div className="flex-1 min-w-0">
              {isEditingName ? (
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 bg-tertiary border border-border rounded-lg text-base font-medium focus:border-accent focus:outline-none"
                  autoFocus
                  placeholder="输入设备名称"
                />
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-medium text-foreground truncate">{settings.deviceName}</h2>
                  <button
                    onClick={() => {
                      setIsEditingName(true);
                      setTempName(settings.deviceName);
                    }}
                    className="p-1 hover:bg-hover rounded flex-shrink-0"
                  >
                    <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                </div>
              )}
              <p className="text-xs text-muted mt-1">在局域网中显示的名称</p>
            </div>
          </div>
        </div>

        {/* 通用设置 */}
        <div>
          <h3 className="text-xs font-medium text-muted mb-3 px-1">通用</h3>
          <div className="bg-secondary rounded-2xl overflow-visible">
            {/* 外观 */}
            <div className="relative border-b border-divider">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-hover first:rounded-t-2xl"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
                  </svg>
                  <span className="text-sm text-foreground">外观</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted">
                  <span>
                    {settings.theme === 'system' ? '跟随系统' : settings.theme === 'dark' ? '深色' : '浅色'}
                  </span>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </button>

              {/* 主题选择菜单 */}
              {showThemeMenu && (
                <>
                  {/* 遮罩层 */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowThemeMenu(false)}
                  />
                  {/* 菜单 */}
                  <div className="absolute right-4 top-full mt-1 bg-tertiary border border-border rounded-xl shadow-2xl overflow-hidden z-50 min-w-[140px]">
                    <button
                      onClick={() => handleThemeChange('system')}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-hover flex items-center justify-between ${settings.theme === 'system' ? 'text-accent' : 'text-foreground'}`}
                    >
                      <span>跟随系统</span>
                      {settings.theme === 'system' && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleThemeChange('dark')}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-hover flex items-center justify-between ${settings.theme === 'dark' ? 'text-accent' : 'text-foreground'}`}
                    >
                      <span>深色</span>
                      {settings.theme === 'dark' && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleThemeChange('light')}
                      className={`w-full px-4 py-3 text-left text-sm hover:bg-hover flex items-center justify-between ${settings.theme === 'light' ? 'text-accent' : 'text-foreground'}`}
                    >
                      <span>浅色</span>
                      {settings.theme === 'light' && (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 主题色 */}
            <div className="relative border-t border-divider">
              <button
                onClick={() => setShowAccentMenu(!showAccentMenu)}
                className="w-full flex items-center justify-between px-4 py-4 hover:bg-hover"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a10 10 0 0110 10" />
                  </svg>
                  <span className="text-sm text-foreground">主题色</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: currentAccentColor.color }}
                  />
                  <span className="text-sm text-muted">{currentAccentColor.name}</span>
                  <svg className="w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </button>

              {/* 主题色选择菜单 */}
              {showAccentMenu && (
                <>
                  {/* 遮罩层 */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAccentMenu(false)}
                  />
                  {/* 菜单 */}
                  <div className="absolute right-4 top-full mt-1 bg-tertiary border border-border rounded-xl shadow-2xl overflow-hidden z-50 min-w-[140px]">
                    {accentColors.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => handleAccentColorChange(color.id)}
                        className={`w-full px-4 py-3 text-left text-sm hover:bg-hover flex items-center justify-between ${settings.accentColor === color.id ? 'text-accent' : 'text-foreground'}`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full border-2 border-white/20"
                            style={{ backgroundColor: color.color }}
                          />
                          <span>{color.name}</span>
                        </div>
                        {settings.accentColor === color.id && (
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 6L9 17l-5-5" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* 可被发现 */}
            <div className="border-t border-divider">
              <button
                onClick={() => !isMobileDevice && onSaveSettings({ discoverable: !settings.discoverable })}
                disabled={isMobileDevice}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-b-2xl ${isMobileDevice
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-hover'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <div className="text-left">
                    <div className="text-sm text-foreground">可被发现</div>
                    {isMobileDevice && (
                      <div className="text-xs text-muted mt-0.5">移动设备无法被发现</div>
                    )}
                  </div>
                </div>
                <div className={`toggle ${settings.discoverable && !isMobileDevice ? 'on' : ''}`}>
                  <div className="toggle-thumb"></div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* 关于 */}
        <div>
          <h3 className="text-xs font-medium text-muted mb-3 px-1">关于</h3>
          <div className="bg-secondary rounded-2xl overflow-hidden">
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
