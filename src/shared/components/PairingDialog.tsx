/**
 * 设备配对对话框组件
 */

import React, { useState, useEffect } from 'react';

interface PairingDialogProps {
  isOpen: boolean;
  mode: 'generate' | 'verify';
  pairingCode?: string;
  deviceName?: string;
  timeRemaining?: number;
  onVerify?: (code: string) => void;
  onCancel?: () => void;
  onClose?: () => void;
}

export const PairingDialog: React.FC<PairingDialogProps> = ({
  isOpen,
  mode,
  pairingCode,
  deviceName,
  timeRemaining = 300,
  onVerify,
  onCancel,
  onClose
}) => {
  const [inputCode, setInputCode] = useState(['', '', '', '', '', '']);
  const [remainingTime, setRemainingTime] = useState(timeRemaining);

  useEffect(() => {
    if (!isOpen || mode !== 'generate') return;

    const timer = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onCancel?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, mode, onCancel]);

  useEffect(() => {
    setRemainingTime(timeRemaining);
  }, [timeRemaining]);

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...inputCode];
    newCode[index] = value.slice(-1);
    setInputCode(newCode);

    // 自动跳转到下一个输入框
    if (value && index < 5) {
      const nextInput = document.getElementById(`code-input-${index + 1}`);
      nextInput?.focus();
    }

    // 自动提交
    if (index === 5 && value) {
      const code = newCode.join('');
      if (code.length === 6) {
        onVerify?.(code);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !inputCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
    setInputCode(newCode);

    if (pastedData.length === 6) {
      onVerify?.(pastedData);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {mode === 'generate' ? '设备配对' : '输入配对码'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {mode === 'generate' ? (
          // 生成配对码模式
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              请在 <span className="font-semibold">{deviceName}</span> 上输入以下配对码：
            </p>

            {/* 配对码显示 */}
            <div className="flex justify-center gap-2 mb-6">
              {pairingCode?.split('').map((digit, index) => (
                <div
                  key={index}
                  className="w-12 h-16 flex items-center justify-center bg-blue-50 dark:bg-blue-900 border-2 border-blue-500 rounded-lg text-3xl font-bold text-blue-600 dark:text-blue-300"
                >
                  {digit}
                </div>
              ))}
            </div>

            {/* 倒计时 */}
            <div className="flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 mb-6">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>配对码将在 {formatTime(remainingTime)} 后过期</span>
            </div>

            {/* 进度条 */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-6">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${(remainingTime / 300) * 100}%` }}
              />
            </div>

            {/* 取消按钮 */}
            <button
              onClick={onCancel}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              取消配对
            </button>
          </div>
        ) : (
          // 验证配对码模式
          <div className="text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              请输入 <span className="font-semibold">{deviceName}</span> 显示的配对码：
            </p>

            {/* 配对码输入 */}
            <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
              {inputCode.map((digit, index) => (
                <input
                  key={index}
                  id={`code-input-${index}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-12 h-16 text-center text-3xl font-bold bg-gray-50 dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                />
              ))}
            </div>

            {/* 提示 */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              提示：可以直接粘贴完整的配对码
            </p>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => onVerify?.(inputCode.join(''))}
                disabled={inputCode.some(d => !d)}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                验证
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
