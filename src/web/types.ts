// 共享类型定义
import type { HistoryItemType } from '../shared/components/HistoryItem';

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

// 使用 shared 中的 HistoryItemType
export type HistoryItem = HistoryItemType;

export interface Settings {
  deviceName: string;
  theme: 'system' | 'dark' | 'light';
  showNotifications: boolean;
  discoverable: boolean;
  accentColor: 'blue' | 'green' | 'purple' | 'pink' | 'orange';
}

export type View = 'transfer' | 'settings' | 'history';

