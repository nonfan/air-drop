import { BrowserWindow, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import { APP_CONFIG } from './config';

export function setupAutoUpdater(mainWindow: BrowserWindow | null) {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info: { version: string }) => {
    mainWindow?.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow?.webContents.send('update-not-available');
  });

  autoUpdater.on('download-progress', (progress: { percent: number }) => {
    mainWindow?.webContents.send('update-download-progress', progress);
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow?.webContents.send('update-downloaded');
    new Notification({
      title: APP_CONFIG.APP_NAME,
      body: '新版本已下载完成，重启应用即可更新'
    }).show();
  });

  autoUpdater.on('error', (error: Error) => {
    mainWindow?.webContents.send('update-error', error.message);
  });
}
