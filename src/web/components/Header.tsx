import { Logo } from './Logo';

import type { View } from '../types';

interface HeaderProps {
  view?: View;
  onViewChange?: (view: View) => void;
}

export function Header({ view, onViewChange }: HeaderProps) {
  return (
    <div className="h-16 bg-background border-b border-border flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <Logo className="w-6 h-6" showText textClassName="text-base font-semibold" />

      {/* 移动端导航按钮 */}
      {onViewChange && (
        <div className="flex md:hidden gap-1 bg-secondary border border-custom rounded-lg p-1">
          <button
            onClick={() => onViewChange('transfer')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'transfer'
              ? 'bg-accent text-white'
              : 'text-muted hover:text-foreground'
              }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            传输
          </button>
          <button
            onClick={() => onViewChange('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === 'settings'
              ? 'bg-accent text-white'
              : 'text-muted hover:text-foreground'
              }`}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            设置
          </button>
        </div>
      )}
    </div>
  );
}
