export interface Settings {
  deviceName: string;
  downloadPath: string;
  autoAccept: boolean;
  showNotifications: boolean;
  theme: 'system' | 'dark' | 'light';
  autoLaunch: boolean;
}

export interface HistoryItem {
  id: string;
  type: 'file' | 'text';
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  content?: string;
  timestamp: number;
  from: string;
  direction: 'sent' | 'received';
}

export type AppError = {
  type: 'network' | 'transfer' | 'storage' | 'unknown';
  message: string;
  code?: string;
  details?: any;
};
