import { Logo } from './Logo';

export function Titlebar() {
  const handleMinimize = () => window.windrop.minimize();
  const handleClose = () => window.windrop.close();

  return (
    <div className="h-11 bg-secondary border-b border-custom flex items-center justify-between px-3">
      <div className="flex items-center gap-2.5 titlebar-drag flex-1 h-full">
        <Logo />
      </div>

      <div className="flex gap-2 titlebar-no-drag">
        <button onClick={handleMinimize} className="w-7 h-7 rounded-md flex items-center justify-center text-secondary hover:bg-hover hover:text-primary transition-all">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button onClick={handleClose} className="w-7 h-7 rounded-md flex items-center justify-center text-secondary hover:bg-danger hover:text-white transition-all">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
