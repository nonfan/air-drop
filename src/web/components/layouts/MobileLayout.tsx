import { ReactNode } from 'react';
import { BottomNavigation } from '../BottomNavigation';
import { MobilePageHeader } from '../MobilePageHeader';
import type { View } from '../../types';

interface MobileLayoutProps {
  children: ReactNode;
  view: View;
  deviceName: string;
  historyCount: number;
  onViewChange: (view: View) => void;
  onClearHistory: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * 移动端布局组件
 * 包含顶部标题栏和底部导航栏（在内容区域内）
 */
export function MobileLayout({
  children,
  view,
  deviceName,
  historyCount,
  onViewChange,
  onClearHistory,
  onDragOver,
  onDragLeave,
  onDrop
}: MobileLayoutProps) {
  return (
    <div
      className="flex h-screen bg-background text-foreground flex-col"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* 移动端顶部栏 */}
      <MobilePageHeader
        view={view}
        deviceName={deviceName}
        historyCount={historyCount}
        onClearHistory={onClearHistory}
      />

      {/* 主内容区 - 包含内容和底部导航 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 内容区域 */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* 移动端底部导航 - 在内容区域内 */}
        <div className="flex-shrink-0">
          <BottomNavigation currentView={view} onViewChange={onViewChange} />
        </div>
      </div>
    </div>
  );
}
