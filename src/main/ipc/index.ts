// IPC 处理器统一导出
import Store from 'electron-store';
import type { DiscoveryService } from '../../core/services/discovery/DiscoveryService';
import type { WebFileServer } from '../services/webServer';
import type { ServiceAdapter } from '../../desktop/adapters/ServiceAdapter';
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
  discovery: () => DiscoveryService | null,
  _transferServer: () => null, // 已移除
  _peerTransferService: () => null, // 已移除
  webServer: () => WebFileServer | null,
  getWebServerURL: () => string,
  serviceAdapter: () => ServiceAdapter | null
) {
  registerDeviceHandlers(store, getMainWindow, discovery, _transferServer, _peerTransferService, webServer);
  registerSettingsHandlers(store, _transferServer, _peerTransferService);
  registerFileHandlers(store, getMainWindow, discovery, _transferServer, _peerTransferService, webServer, serviceAdapter);
  registerWebHandlers(getWebServerURL, webServer);
  registerHistoryHandlers(store);
  registerUpdateHandlers();
  registerWindowHandlers(getMainWindow);
}

export { setIsQuitting } from './update';
