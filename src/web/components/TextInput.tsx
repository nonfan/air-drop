interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TextInput({ value, onChange }: TextInputProps) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="输入要发送的文本..."
        className="w-full h-48 p-4 bg-secondary border border-custom rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-accent transition-all"
      />
      <button
        onClick={handlePaste}
        className="flex items-center gap-2 px-4 py-2.5 bg-secondary hover:bg-tertiary border border-custom rounded-xl transition-all text-sm font-medium"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
          <rect x="8" y="2" width="8" height="4" rx="1" />
        </svg>
        从剪贴板粘贴
      </button>
    </div>
  );
}
