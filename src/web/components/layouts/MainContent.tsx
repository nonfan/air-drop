import { ReactNode } from 'react';

interface MainContentProps {
  children: ReactNode;
}

/**
 * 主内容区布局组件
 * 包含桌面端标题栏、移动端标题栏和内容区域
 */
export function MainContent({ children }: MainContentProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
