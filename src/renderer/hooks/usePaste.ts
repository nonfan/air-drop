// 粘贴事件 Hook
import { useEffect } from 'react';
import type { FileItem } from '../types';

export function usePaste(onPaste: (files: FileItem[]) => void) {
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      e.preventDefault();
      const files = await window.windrop.getClipboardFiles();
      if (files.length > 0) {
        onPaste(files);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [onPaste]);
}
