import type { View } from '../types';

interface MobilePageHeaderProps {
  view: View;
  deviceName?: string;
  historyCount?: number;
  onClearHistory?: () => void;
}

export function MobilePageHeader({
  view,
  deviceName,
  historyCount = 0,
  onClearHistory
}: MobilePageHeaderProps) {
  return (
    <div className="flex-shrink-0 md:hidden">
      <div className="px-6 bg-background">
        {view === 'transfer' && (
          <div className="flex items-center gap-2 h-[88px]">
            <span className="text-xl font-semibold text-foreground leading-none">
              你好, {deviceName}
            </span>
            <span className="text-2xl leading-none">👋</span>
          </div>
        )}

        {view === 'history' && (
          <div className="flex items-center justify-between h-[88px]">
            <h1 className="text-xl font-semibold text-foreground leading-none">传输记录</h1>
            {historyCount > 0 && onClearHistory && (
              <button
                onClick={onClearHistory}
                className="text-sm text-danger hover:text-danger/80 font-medium transition-colors leading-none"
              >
                清空
              </button>
            )}
          </div>
        )}

        {view === 'settings' && (
          <div className="h-[88px] flex items-center">
            <h1 className="text-xl font-semibold text-foreground leading-none">设置</h1>
          </div>
        )}
      </div>
    </div>
  );
}
