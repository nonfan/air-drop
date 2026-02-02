import type { View } from '../types';

interface SidebarProps {
  view: View;
  onViewChange: (view: View) => void;
}

export function Sidebar({ view, onViewChange }: SidebarProps) {
  return (
    <div className="hidden md:flex w-16 bg-secondary border-r border-border flex-col py-3 flex-shrink-0">
      <div className="flex flex-col gap-1.5 px-2">
        <button
          onClick={() => onViewChange('transfer')}
          className={`sidebar-btn ${view === 'transfer' ? 'active' : ''}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span className="text-[9px] font-semibold">传输</span>
        </button>

        <button
          onClick={() => onViewChange('settings')}
          className={`sidebar-btn ${view === 'settings' ? 'active' : ''}`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span className="text-[9px] font-semibold">设置</span>
        </button>
      </div>

      <div className="mt-auto flex flex-col items-center gap-2.5 px-2">
        <div className="flex flex-col items-center gap-1.5 text-[9px] text-muted text-center">
          <div className="status-dot"></div>
          <span className="font-medium">在线</span>
        </div>
      </div>
    </div>
  );
}
