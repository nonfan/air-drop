interface TextModalProps {
  isOpen: boolean;
  text: string;
  onTextChange: (text: string) => void;
  onClose: () => void;
  onSend: () => void;
  disabled?: boolean;
}

/**
 * 文本输入弹窗组件
 * 用于移动端输入文本消息
 */
export function TextModal({
  isOpen,
  text,
  onTextChange,
  onClose,
  onSend,
  disabled = false
}: TextModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-secondary rounded-2xl p-6 w-full max-w-md animate-scale-in shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">发送文本</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-hover transition-colors"
          >
            <svg
              className="w-5 h-5 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="输入要发送的文本..."
          className="w-full h-32 px-4 py-3 bg-tertiary rounded-xl border border-border focus:border-accent focus:outline-none resize-none text-foreground placeholder:text-muted"
          autoFocus
        />
        <button
          onClick={() => {
            onSend();
            onClose();
          }}
          disabled={disabled}
          className="w-full mt-4 py-3 rounded-xl bg-accent text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-accent-hover active:scale-[0.98]"
        >
          发送
        </button>
      </div>
    </div>
  );
}
