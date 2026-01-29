interface TextInputProps {
  textInput: string;
  onTextChange: (text: string) => void;
  onPasteFromClipboard: () => void;
}

export function TextInput({ textInput, onTextChange, onPasteFromClipboard }: TextInputProps) {
  return (
    <div className="bg-secondary rounded-2xl overflow-hidden flex flex-col h-40">
      <textarea
        value={textInput}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder="输入或粘贴文本..."
        className="flex-1 w-full p-4 bg-transparent border-none text-primary text-sm leading-relaxed resize-none outline-none placeholder:text-muted"
      />
      <div className="flex items-center justify-between p-3 border-t border-custom">
        <button
          onClick={onPasteFromClipboard}
          className="flex items-center gap-2 px-3.5 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent-hover transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
          粘贴
        </button>
        <span className="text-xs text-muted">
          <span className="font-medium">{textInput.length}</span> 字
        </span>
      </div>
    </div>
  );
}
