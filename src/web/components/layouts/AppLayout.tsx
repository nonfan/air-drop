import { ReactNode } from 'react';

interface AppLayoutProps {
  children: ReactNode;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

/**
 * 应用主布局组件
 * 提供拖放支持和基础布局结构
 */
export function AppLayout({ children, onDragOver, onDragLeave, onDrop }: AppLayoutProps) {
  return (
    <div
      className="flex h-screen bg-background text-foreground"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}
