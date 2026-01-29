// IPC 处理器 - 窗口相关
import { ipcMain } from 'electron';

export function registerWindowHandlers(getMainWindow: () => Electron.BrowserWindow | null) {
  ipcMain.on('window-minimize', () => getMainWindow()?.minimize());
  ipcMain.on('window-close', () => getMainWindow()?.hide());
}
