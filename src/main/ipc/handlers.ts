// IPC 处理器 - 设备相关
import { ipcMain } from 'electron';
import Store from 'electron-store';
import type { DiscoveryService } from '../../core/services/discovery/DiscoveryService';
import type { WebFileServer } from '../services/webServer';
import type { StoreSchema } from '../store';

export function registerDeviceHandlers(
  store: Store<StoreSchema>,
  getMainWindow: () => Electron.BrowserWindow | null,
  discovery: () => DiscoveryService | null,
  _transferServer: () => null, // 已移除
  _peerTransferService: () => null, // 已移除
  webServer: () => WebFileServer | null
) {
  ipcMain.handle('get-devices', () => discovery()?.getDevices() || []);
  ipcMain.handle('get-device-name', () => store.get('deviceName'));
  ipcMain.handle('set-device-name', (_e, name: string) => {
    store.set('deviceName', name);
  });

  ipcMain.handle('get-mobile-clients', () => {
    return webServer()?.getConnectedClients() || [];
  });
}
