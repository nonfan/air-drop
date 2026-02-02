import { ReactNode } from 'react';

interface ContentAreaProps {
  children: ReactNode;
  className?: string;
}

/**
 * 内容区域组件
 * 提供可滚动的内容容器
 */
export function ContentArea({ children, className = '' }: ContentAreaProps) {
  return (
    <div className={`flex-1 overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
