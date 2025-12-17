export interface Device {
  id: string;
  name: string;
  ip: string;
  port: number;
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
      onMobileConnected: (callback: (client: { id: string; name: string; ip: string }) => void) => void;
      onMobileDisconnected: (callback: (client: { id: string; name: string; ip: string }) => void) => void;
      onMobileUpdated: (callback: (client: { id: string; name: string; ip: string }) => void) => void;
      onWebUploadStart: (callback: (info: { name: string; size: number }) => void) => void;
      onWebUploadProgress: (callback: (progress: { name: string; percent: number }) => void) => void;
      onWebUploadComplete: (callback: (info: { name: string; size: number }) => void) => void;
      // Transfer history
      getTransferHistory: () => Promise<any[]>;
      clearTransferHistory: () => Promise<any[]>;
      openFile: (filePath: string) => Promise<boolean>;
      showFileInFolder: (filePath: string) => Promise<boolean>;
      onTransferHistoryUpdated: (callback: (history: any[]) => void) => void;
      // File downloaded event
      onFileDownloaded: (callback: (info: { id: string; name: string; size: number }) => void) => void;
      // Text transfer events
      onTextReceived: (callback: (info: { text: string; clientId: string; clientName: string }) => void) => void;
      onTextCopied: (callback: (info: { id: string; text: string; clientId: string }) => void) => void;
    };
  }
}
