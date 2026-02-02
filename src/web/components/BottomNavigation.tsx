import type { View } from '../types';

interface BottomNavigationProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

export function BottomNavigation({ currentView, onViewChange }: BottomNavigationProps) {
  const tabs = [
    { id: 'transfer', icon: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2zM9 22V12h6v10" />, label: '主页' },
    { id: 'history', icon: <path d="M9 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM9 2v6h6" />, label: '历史' },
    { id: 'settings', icon: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>, label: '设置' }
  ];

  return (
    <div className="fixed bottom-0 w-full py-4 px-4 md:hidden flex justify-center">
      <nav className="
        relative flex items-center gap-1 p-1.5
        bg-secondary/95 backdrop-blur-xl 
        rounded-full border border-border
      ">
        {tabs.map((tab) => {
          const isActive = currentView === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onViewChange(tab.id as View)}
              className="
                relative flex flex-col items-center justify-center
                w-[72px] h-[44px] rounded-full
                transition-all duration-200
                active:scale-95
              "
              style={{
                color: isActive ? 'var(--accent)' : 'var(--muted)',
                backgroundColor: isActive ? 'var(--accent-bg)' : 'transparent'
              }}
            >
              <svg
                className="w-6 h-6 transition-transform duration-200"
                style={{
                  transform: isActive ? 'scale(1.1)' : 'scale(1)'
                }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {tab.icon}
              </svg>
            </button>
          );
        })}
      </nav>
    </div>
  );
}