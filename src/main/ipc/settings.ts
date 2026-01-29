// IPC 处理器 - 设置相关
import { ipcMain, app } from 'electron';
import Store from 'electron-store';
import type { FileTransferServer } from '../services/transfer';
import type { PeerTransferService } from '../services/peerTransfer';
import type { StoreSchema } from '../store';

let autoLaunchTimer: NodeJS.Timeout | null = null;

export function registerSettingsHandlers(
  store: Store<StoreSchema>,
  transferServer: () => FileTransferServer | null,
  peerTransferService: () => PeerTransferService | null
) {
  ipcMain.handle('get-settings', () => ({
    deviceName: store.get('deviceName'),
    downloadPath: store.get('downloadPath'),
    autoAccept: store.get('autoAccept'),
    showNotifications: store.get('showNotifications'),
    theme: store.get('theme') || 'system',
    autoLaunch: store.get('autoLaunch') || false
  }));

  ipcMain.handle('set-settings', (_e, settings: Partial<StoreSchema>) => {
    if (settings.deviceName) store.set('deviceName', settings.deviceName);
    if (settings.downloadPath) {
      store.set('downloadPath', settings.downloadPath);
      transferServer()?.setDownloadPath(settings.downloadPath);
      peerTransferService()?.setDownloadPath(settings.downloadPath);
    }
    if (typeof settings.autoAccept === 'boolean') store.set('autoAccept', settings.autoAccept);
    if (typeof settings.showNotifications === 'boolean') store.set('showNotifications', settings.showNotifications);
    if (settings.theme) store.set('theme', settings.theme);
    if (typeof settings.autoLaunch === 'boolean') {
      store.set('autoLaunch', settings.autoLaunch);
      if (autoLaunchTimer) clearTimeout(autoLaunchTimer);
      const autoLaunchValue = settings.autoLaunch;
      autoLaunchTimer = setTimeout(() => {
        try {
          app.setLoginItemSettings({ openAtLogin: autoLaunchValue });
        } catch (e) {
          console.error('Failed to set login item:', e);
        }
        autoLaunchTimer = null;
      }, 300);
    }
  });
}
