// IPC 处理器 - 更新相关
import { ipcMain, app } from 'electron';
import { autoUpdater } from 'electron-updater';

let isQuitting = false;

export function setIsQuitting(value: boolean) {
  isQuitting = value;
}

export function registerUpdateHandlers() {
  ipcMain.handle('check-for-updates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      return { available: result?.updateInfo?.version !== app.getVersion(), version: result?.updateInfo?.version };
    } catch (error) {
      return { available: false, error: String(error) };
    }
  });

  ipcMain.handle('get-app-version', () => app.getVersion());

  ipcMain.handle('download-update', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('install-update', () => {
    isQuitting = true;
    autoUpdater.quitAndInstall(false, true);
  });
}
