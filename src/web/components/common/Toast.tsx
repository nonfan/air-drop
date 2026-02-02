interface ToastProps {
  message: string | null;
}

/**
 * Toast 通知组件
 * 用于显示临时提示消息
 */
export function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div className="toast fade-in">
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
