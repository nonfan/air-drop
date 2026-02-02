import { ReactNode } from 'react';
import { Sidebar } from '../Sidebar';
import { Header } from '../Header';
import type { View } from '../../types';

interface DesktopLayoutProps {
  children: ReactNode;
  view: View;
  deviceName: string;
  appVersion: string;
  onViewChange: (view: View) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * 桌面端布局组件
 * 包含侧边栏、顶部标题栏和底部信息栏
 */
export function DesktopLayout({
  children,
  view,
  deviceName,
  appVersion,
  onViewChange,
  onDragOver,
  onDragLeave,
  onDrop
}: DesktopLayoutProps) {
  return (
    <div
      className="flex h-screen bg-background text-foreground"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* 桌面端侧边栏 */}
      <Sidebar view={view} onViewChange={onViewChange} />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 桌面端顶部标题栏 */}
        <Header view={view} onViewChange={onViewChange} />

        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* 桌面端 Footer */}
        {view === 'transfer' && (
          <div className="flex-shrink-0 px-6 py-3 border-t border-border bg-secondary/50">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{deviceName}</span>
              <span>v{appVersion}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
