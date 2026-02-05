import { Logo } from './Logo';

export function Titlebar() {
  const handleMinimize = () => window.windrop.minimize();
  const handleMaximize = () => window.windrop.maximize();
  const handleClose = () => window.windrop.close();

  return (
    <div className="h-12 bg-secondary/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 rounded-t-[12px]">
      {/* 左侧 Logo 和应用名称 */}
      <div className="flex items-center gap-3 titlebar-drag flex-1 h-full">
        <div className="flex items-center gap-2.5">
          <Logo className="w-5 h-5" showText={true} textClassName="text-sm font-semibold tracking-tight text-primary" />
        </div>
      </div>

      {/* 右侧窗口控制按钮 */}
      <div className="flex gap-2 titlebar-no-drag">
        <button
          onClick={handleMinimize}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-white/5 hover:text-primary transition-all group"
          title="最小化"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M5 12h14" />
          </svg>
        </button>

        <button
          onClick={handleMaximize}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-white/5 hover:text-primary transition-all group"
          title="最大化"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
        </button>

        <button
          onClick={handleClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-danger/90 hover:text-white transition-all group"
          title="关闭"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
