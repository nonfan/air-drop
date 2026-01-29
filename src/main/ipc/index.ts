// IPC 处理器统一导出
import Store from 'electron-store';
import type { IDeviceDiscovery } from '../services/serviceManager';
import type { FileTransferServer } from '../services/transfer';
import type { PeerTransferService } from '../services/peerTransfer';
import type { WebFileServer } from '../services/webServer';
import { registerDeviceHandlers } from './handlers';
import { registerSettingsHandlers } from './settings';
import { registerFileHandlers } from './files';
import { registerWebHandlers } from './web';
import { registerHistoryHandlers } from './history';
import { registerUpdateHandlers } from './update';
import { registerWindowHandlers } from './window';

interface StoreSchema {
  deviceName: string;
  downloadPath: string;
  autoAccept: boolean;
  showNotifications: boolean;
  theme: 'system' | 'dark' | 'light';
  autoLaunch: boolean;
  transferHistory: any[];
  textHistory: any[];
}

export function registerAllHandlers(
  store: Store<StoreSchema>,
  getMainWindow: () => Electron.BrowserWindow | null,
  discovery: () => IDeviceDiscovery | null,
  transferServer: () => FileTransferServer | null,
  peerTransferService: () => PeerTransferService | null,
  webServer: () => WebFileServer | null,
  getWebServerURL: () => string
) {
  registerDeviceHandlers(store, getMainWindow, discovery, transferServer, peerTransferService, webServer);
  registerSettingsHandlers(store, transferServer, peerTransferService);
  registerFileHandlers(store, getMainWindow, discovery, transferServer, peerTransferService, webServer);
  registerWebHandlers(getWebServerURL, webServer);
  registerHistoryHandlers(store);
  registerUpdateHandlers();
  registerWindowHandlers(getMainWindow);
}

export { setIsQuitting } from './update';
