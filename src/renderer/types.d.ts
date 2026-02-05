export interface Device {
  id: string;
  name: string;
  model?: string;
  ip: string;
  port?: number;
  type: 'pc' | 'mobile';
}

export interface FileTransferInfo {
  transferId: string;
  senderName: string;
  files: { name: string; size: number }[];
  totalSize: number;
}

export interface Settings {
  deviceName: string;
  downloadPath: string;
  autoAccept: boolean;
  showNotifications: boolean;
  theme: 'system' | 'dark' | 'light';
  autoLaunch: boolean;
}

export interface TransferProgress {
  transferId?: string;
  percent: number;
  receivedSize?: number;
  sentSize?: number;
  totalSize: number;
  currentFile: string;
}

export interface FileInfo {
  name: string;
  size: number;
  path: string;
}

export interface TransferRecord {
  id: string;
  fileName: string;
  filePath: string;
  size: number;
  from: string;
  timestamp: number;
  type: 'received' | 'sent';
}

export interface FileItem {
  name: string;
  size: number;
  path: string;
}

export interface SharedFile {
  id: string;
  name: string;
  size: number;
  path: string;
  targetId: string;
}

export interface SharedText {
  id: string;
  text: string;
  targetId: string;
}

export interface ReceivedText {
  id: string;
  text: string;
  from: string;
  timestamp: number;
}

declare global {
  interface Window {
    windrop: {
      getDevices: () => Promise<Device[]>;
      getDeviceName: () => Promise<string>;
      setDeviceName: (name: string) => Promise<void>;
      getSettings: () => Promise<Settings>;
      setSettings: (settings: Partial<Settings>) => Promise<void>;
      selectFolder: () => Promise<string | null>;
      openDownloadFolder: () => Promise<void>;
      selectFiles: () => Promise<string[]>;
      getFileInfo: (path: string) => Promise<FileInfo | null>;
      sendFiles: (deviceId: string, files: string[]) => Promise<void>;
      acceptTransfer: (transferId: string) => Promise<void>;
      rejectTransfer: (transferId: string) => Promise<void>;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      onDeviceFound: (callback: (device: Device) => void) => void;
      onDeviceLost: (callback: (deviceId: string) => void) => void;
      onIncomingFile: (callback: (info: FileTransferInfo) => void) => void;
      onTransferProgress: (callback: (progress: TransferProgress) => void) => void;
      onSendProgress: (callback: (progress: TransferProgress) => void) => void;
      onTransferComplete: (callback: (result: { transferId: string; success: boolean }) => void) => void;
      onSendComplete: (callback: (result: { success: boolean; reason?: string }) => void) => void;
      // Web server
      getWebURL: () => Promise<string>;
      copyWebURL: () => Promise<boolean>;
      shareFileWeb: (filePath: string, targetClientId?: string) => Promise<string>;
      unshareFileWeb: (fileId: string) => Promise<void>;
      getMobileClients: () => Promise<{ id: string; name: string; ip: string }[]>;
      shareTextWeb: (text: string, targetClientId?: string) => Promise<string>;
      unshareTextWeb: (textId: string) => Promise<void>;
      getClipboardText: () => Promise<string>;
      copyText: (text: string) => Promise<boolean>;
      getClipboardFiles: () => Promise<{ name: string; size: number; path: string }[]>;
      onMobileConnected: (callback: (client: { id: string; name: string; model?: string; ip: string }) => void) => void;
      onMobileDisconnected: (callback: (client: { id: string; name: string; model?: string; ip: string }) => void) => void;
      onMobileUpdated: (callback: (client: { id: string; name: string; model?: string; ip: string }) => void) => void;
      onWebUploadStart: (callback: (info: { name: string; size: number }) => void) => void;
      onWebUploadProgress: (callback: (progress: { name: string; percent: number }) => void) => void;
      onWebUploadComplete: (callback: (info: { name: string; size: number }) => void) => void;
      onMobileDownloadProgress: (callback: (progress: { fileName: string; percent: number; receivedSize: number; totalSize: number }) => void) => void;
      onMobileUploadProgress: (callback: (progress: { fileName: string; percent: number; sentSize: number; totalSize: number }) => void) => void;
      // Transfer history
      getTransferHistory: () => Promise<any[]>;
      clearTransferHistory: () => Promise<any[]>;
      openFile: (filePath: string) => Promise<boolean>;
      showFileInFolder: (filePath: string) => Promise<boolean>;
      onTransferHistoryUpdated: (callback: (history: any[]) => void) => void;
      // Text history
      getTextHistory: () => Promise<any[]>;
      clearTextHistory: () => Promise<any[]>;
      onTextHistoryUpdated: (callback: (history: any[]) => void) => void;
      // File downloaded event
      onFileDownloaded: (callback: (info: { id: string; name: string; size: number }) => void) => void;
      // Text transfer events
      onTextReceived: (callback: (info: { text: string; clientId: string; clientName: string; id?: string; timestamp?: number }) => void) => void;
      onTextCopied: (callback: (info: { id: string; text: string; clientId: string }) => void) => void;
      // 应用更新
      getAppVersion: () => Promise<string>;
      checkForUpdates: () => Promise<{ available: boolean; version?: string; error?: string }>;
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
      installUpdate: () => void;
      onUpdateAvailable: (callback: (info: any) => void) => void;
      onUpdateNotAvailable: (callback: () => void) => void;
      onUpdateDownloadProgress: (callback: (progress: any) => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
      onUpdateError: (callback: (error: string) => void) => void;
    };
  }
}
