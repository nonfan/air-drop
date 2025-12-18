import { contextBridge, ipcRenderer } from 'electron';

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

contextBridge.exposeInMainWorld('windrop', {
  // Device discovery
  getDevices: () => ipcRenderer.invoke('get-devices'),
  getDeviceName: () => ipcRenderer.invoke('get-device-name'),
  setDeviceName: (name: string) => ipcRenderer.invoke('set-device-name', name),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings: Partial<Settings>) => ipcRenderer.invoke('set-settings', settings),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openDownloadFolder: () => ipcRenderer.invoke('open-download-folder'),
  
  // File operations
  selectFiles: () => ipcRenderer.invoke('select-files'),
  getFileInfo: (path: string) => ipcRenderer.invoke('get-file-info', path),
  sendFiles: (deviceId: string, files: string[]) => 
    ipcRenderer.invoke('send-files', { deviceId, files }),
  acceptTransfer: (transferId: string) => ipcRenderer.invoke('accept-transfer', transferId),
  rejectTransfer: (transferId: string) => ipcRenderer.invoke('reject-transfer', transferId),
  
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  
  // Events
  onDeviceFound: (callback: (device: Device) => void) => {
    ipcRenderer.on('device-found', (_e, device) => callback(device));
  },
  onDeviceLost: (callback: (deviceId: string) => void) => {
    ipcRenderer.on('device-lost', (_e, deviceId) => callback(deviceId));
  },
  onIncomingFile: (callback: (info: FileTransferInfo) => void) => {
    ipcRenderer.on('incoming-file', (_e, info) => callback(info));
  },
  onTransferProgress: (callback: (progress: TransferProgress) => void) => {
    ipcRenderer.on('transfer-progress', (_e, progress) => callback(progress));
  },
  onSendProgress: (callback: (progress: TransferProgress) => void) => {
    ipcRenderer.on('send-progress', (_e, progress) => callback(progress));
  },
  onTransferComplete: (callback: (result: { transferId: string; success: boolean }) => void) => {
    ipcRenderer.on('transfer-complete', (_e, result) => callback(result));
  },
  onSendComplete: (callback: (result: { success: boolean; reason?: string }) => void) => {
    ipcRenderer.on('send-complete', (_e, result) => callback(result));
  },

  // Web server
  getWebURL: () => ipcRenderer.invoke('get-web-url'),
  copyWebURL: () => ipcRenderer.invoke('copy-web-url'),
  shareFileWeb: (filePath: string, targetClientId?: string) => ipcRenderer.invoke('share-file-web', filePath, targetClientId),
  unshareFileWeb: (fileId: string) => ipcRenderer.invoke('unshare-file-web', fileId),
  getMobileClients: () => ipcRenderer.invoke('get-mobile-clients'),
  shareTextWeb: (text: string, targetClientId?: string) => ipcRenderer.invoke('share-text-web', text, targetClientId),
  unshareTextWeb: (textId: string) => ipcRenderer.invoke('unshare-text-web', textId),
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text'),
  getClipboardFiles: () => ipcRenderer.invoke('get-clipboard-files'),
  
  // Mobile client events
  onMobileConnected: (callback: (client: { id: string; name: string; ip: string }) => void) => {
    ipcRenderer.on('mobile-connected', (_e, client) => callback(client));
  },
  onMobileDisconnected: (callback: (client: { id: string; name: string; ip: string }) => void) => {
    ipcRenderer.on('mobile-disconnected', (_e, client) => callback(client));
  },
  onMobileUpdated: (callback: (client: { id: string; name: string; ip: string }) => void) => {
    ipcRenderer.on('mobile-updated', (_e, client) => callback(client));
  },
  
  // Web upload events
  onWebUploadStart: (callback: (info: { name: string; size: number }) => void) => {
    ipcRenderer.on('web-upload-start', (_e, info) => callback(info));
  },
  onWebUploadProgress: (callback: (progress: { name: string; percent: number }) => void) => {
    ipcRenderer.on('web-upload-progress', (_e, progress) => callback(progress));
  },
  onWebUploadComplete: (callback: (info: { name: string; size: number }) => void) => {
    ipcRenderer.on('web-upload-complete', (_e, info) => callback(info));
  },

  // Transfer history
  getTransferHistory: () => ipcRenderer.invoke('get-transfer-history'),
  clearTransferHistory: () => ipcRenderer.invoke('clear-transfer-history'),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  showFileInFolder: (filePath: string) => ipcRenderer.invoke('show-file-in-folder', filePath),
  onTransferHistoryUpdated: (callback: (history: any[]) => void) => {
    ipcRenderer.on('transfer-history-updated', (_e, history) => callback(history));
  },
  
  // Text history
  getTextHistory: () => ipcRenderer.invoke('get-text-history'),
  clearTextHistory: () => ipcRenderer.invoke('clear-text-history'),
  onTextHistoryUpdated: (callback: (history: any[]) => void) => {
    ipcRenderer.on('text-history-updated', (_e, history) => callback(history));
  },
  
  // 手机下载完成事件
  onFileDownloaded: (callback: (info: { id: string; name: string; size: number }) => void) => {
    ipcRenderer.on('file-downloaded', (_e, info) => callback(info));
  },
  
  // 文本传送事件
  onTextReceived: (callback: (info: { text: string; clientId: string; clientName: string }) => void) => {
    ipcRenderer.removeAllListeners('text-received');
    ipcRenderer.on('text-received', (_e, info) => callback(info));
  },
  onTextCopied: (callback: (info: { id: string; text: string; clientId: string }) => void) => {
    ipcRenderer.removeAllListeners('text-copied');
    ipcRenderer.on('text-copied', (_e, info) => callback(info));
  },
  
  // 应用更新
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (_e, info) => callback(info));
  },
  onUpdateNotAvailable: (callback: () => void) => {
    ipcRenderer.on('update-not-available', () => callback());
  },
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('update-download-progress', (_e, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback: () => void) => {
    ipcRenderer.on('update-downloaded', () => callback());
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_e, error) => callback(error));
  }
});
