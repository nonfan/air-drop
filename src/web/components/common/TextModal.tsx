import { useEffect, useState } from 'react';

interface TextModalProps {
  isOpen: boolean;
  text: string;
  onTextChange: (text: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  disabled?: boolean;
}

/**
 * 文本输入弹窗组件
 * 用于移动端输入文本消息
 * 底部弹出样式，包含取消和确认按钮
 * 支持键盘弹出时自动向上推
 */
export function TextModal({
  isOpen,
  text,
  onTextChange,
  onClose,
  onConfirm,
  disabled = false
}: TextModalProps) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // 监听键盘弹出/收起
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (window.visualViewport) {
        // 计算键盘高度：窗口高度 - 可视区域高度
        const keyboardHeight = window.innerHeight - window.visualViewport.height;
        setKeyboardHeight(keyboardHeight > 0 ? keyboardHeight : 0);
      }
    };

    // 监听 visualViewport 变化（更准确地检测键盘）
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize);
    }

    // 初始检查
    handleResize();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      }
      setKeyboardHeight(0);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!text.trim()) return;
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 md:hidden flex items-end justify-center pb-2">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
      />

      {/* 底部弹窗内容 */}
      <div
        className="relative w-full max-w-sm bg-secondary rounded-2xl shadow-2xl animate-slide-up transition-transform duration-200 mx-4 mb-2"
        style={{
          // 键盘弹出时向上推
          transform: keyboardHeight > 0 ? `translateY(-${keyboardHeight}px)` : 'none',
          // 限制最大高度
          maxHeight: keyboardHeight > 0
            ? `calc(100vh - ${keyboardHeight}px - 16px)`
            : 'calc(100vh - env(safe-area-inset-bottom) - 16px)'
        }}
      >
        {/* 文本输入区域 */}
        <div className="p-4 pt-5">
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="输入要发送的文本..."
            className="w-full h-32 px-3 py-2.5 bg-tertiary rounded-xl border border-border focus:border-accent focus:outline-none resize-none text-sm text-foreground placeholder:text-muted"
            autoFocus
          />
        </div>

        {/* 底部按钮区域 */}
        <div className="px-4 pb-4 flex gap-2.5 safe-area-bottom">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-tertiary text-foreground text-sm font-medium transition-all hover:bg-hover active:scale-[0.98]"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={disabled || !text.trim()}
            className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:bg-accent-hover active:scale-[0.98]"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}
