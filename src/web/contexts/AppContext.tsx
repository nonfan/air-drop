import { createContext, useContext } from 'react';
import type { Device, FileItem, TransferProgress, HistoryItem, Settings } from '../types';

export interface AppContextType {
  // 状态
  mode: 'file' | 'text';
  devices: Device[];
  selectedDevice: string | null;
  selectedFiles: FileItem[];
  text: string;
  history: HistoryItem[];
  settings: Settings;
  isSending: boolean;
  sendProgress: TransferProgress | null;
  downloadProgress: TransferProgress | null;
  isDragging: boolean;
  copiedId: string | null;
  copyFailedId: string | null;
  copiedTextIds: Set<string>;
  downloadingId: string | null;
  downloadFailedId: string | null;
  downloadedIds: Set<string>;
  downloadFailedIds: Set<string>;
  downloadProgressMap: Map<string, { percent: number; receivedSize: number; totalSize: number }>;
  showAllHistory: boolean;
  appVersion: string;
  isMobile: boolean;

  // 方法
  setMode: (mode: 'file' | 'text') => void;
  onSelectDevice: (id: string) => void;
  onFilesChange: (files: FileItem[]) => void;
  onSelectFiles: () => void;
  onTextChange: (text: string) => void;
  onSend: (deviceId?: string) => void;
  onCopyText: (text: string, id: string) => void;
  onDownloadFile: (filePath: string, fileName: string, itemId: string) => void;
  onClearHistory: () => void;
  onToggleShowAll: () => void;
  onSaveSettings: (settings: Partial<Settings>) => void;
  onShowTextModal: () => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
