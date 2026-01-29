// 共享类型定义

export interface Device {
  id: string;
  name: string;
  model: string;
  ip: string;
  type: 'pc' | 'mobile';
}

export interface FileItem {
  name: string;
  size: number;
  file: File;
}

export interface TransferProgress {
  percent: number;
  currentFile: string;
  totalSize: number;
  sentSize?: number;
}

export interface HistoryItem {
  id: string;
  type: 'text' | 'file';
  content?: string;
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  timestamp: number;
  status: 'success' | 'failed' | 'pending';
  direction: 'sent' | 'received';
  from?: string;
}

export interface Settings {
  deviceName: string;
  theme: 'system' | 'dark' | 'light';
  showNotifications: boolean;
}

export type View = 'transfer' | 'settings';
