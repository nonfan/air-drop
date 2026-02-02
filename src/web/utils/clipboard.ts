/**
 * 剪贴板相关工具函数
 */

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @returns Promise<boolean> 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // 优先使用 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 降级方案：使用传统的 execCommand
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        return successful;
      } finally {
        document.body.removeChild(textArea);
      }
    }
  } catch (error) {
    console.error('Copy failed:', error);
    return false;
  }
}
