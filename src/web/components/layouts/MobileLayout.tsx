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
 * 包含顶部标题栏和悬浮的底部导航栏
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

      {/* 主内容区 - 相对定位容器 */}
      {/* 滚动内容 - 添加底部 padding 为导航留出空间 */}
      <div className="pb-20">
        {children}
      </div>

      {/* 移动端底部导航 - 绝对定位悬浮在内容区域底部 */}
      <BottomNavigation currentView={view} onViewChange={onViewChange} />
    </div>
  );
}
