interface EmptyStateProps {
  icon: React.ReactNode;
  message: string;
}

/**
 * 空状态组件
 * 用于显示无数据时的占位内容
 */
export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-16">
      <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
