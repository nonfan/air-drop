/**
 * 共享类型定义
 */

// 设备类型
export interface Device {
  id: string;
  name: string;
  model?: string;
  ip: string;
  port?: number;
  type: 'pc' | 'mobile';
  peerId?: string;
}

// 文件项
export interface FileItem {
  name: string;
  size: number;
  file: File;
}

// 传输进度
export interface TransferProgress {
  percent: number;
  currentFile: string;
  totalSize: number;
  sentSize: number;
}

// 历史记录项
export interface HistoryItem {
  id: string;
  type: 'file' | 'text';
  fileName?: string;
  fileSize?: number;
  filePath?: string;
  content?: string;
  timestamp: number;
  status: 'success' | 'failed' | 'pending';
  direction: 'sent' | 'received';
  from?: string;
  to?: string;
}

// 设置
export interface Settings {
  deviceName: string;
  theme: 'light' | 'dark' | 'system';
  showNotifications: boolean;
  autoAccept?: boolean;
  downloadPath?: string;
}

// 视图类型
export type View = 'transfer' | 'history' | 'settings';

// 传输模式
export type TransferMode = 'file' | 'text';

// 传输状态
export type TransferStatus = 'idle' | 'sending' | 'receiving' | 'success' | 'failed';

// 连接状态
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

// 通知类型
export type NotificationType = 'info' | 'success' | 'warning' | 'error';

// 通知选项
export interface NotificationOptions {
  title: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

// API 响应
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 文件传输请求
export interface FileTransferRequest {
  targetDeviceId: string;
  files: FileItem[];
}

// 文本传输请求
export interface TextTransferRequest {
  targetDeviceId: string;
  text: string;
}
