// IPC 处理器 - 设备相关
import { ipcMain } from 'electron';
import Store from 'electron-store';
import type { IDeviceDiscovery } from '../services/serviceManager';
import type { FileTransferServer } from '../services/transfer';
import type { PeerTransferService } from '../services/peerTransfer';
import type { WebFileServer } from '../services/webServer';
import type { StoreSchema } from '../store';

export function registerDeviceHandlers(
  store: Store<StoreSchema>,
  getMainWindow: () => Electron.BrowserWindow | null,
  discovery: () => IDeviceDiscovery | null,
  transferServer: () => FileTransferServer | null,
  peerTransferService: () => PeerTransferService | null,
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
