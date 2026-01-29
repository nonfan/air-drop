// IPC 处理器 - Web 服务器相关
import { ipcMain, clipboard } from 'electron';
import type { WebFileServer } from '../services/webServer';

export function registerWebHandlers(
  getWebServerURL: () => string,
  webServer: () => WebFileServer | null
) {
  // 动态获取 Web URL，每次调用时重新计算
  ipcMain.handle('get-web-url', () => {
    const server = webServer();
    if (server) {
      return server.getURL();
    }
    return getWebServerURL();
  });
  
  ipcMain.handle('copy-web-url', () => {
    const server = webServer();
    const url = server ? server.getURL() : getWebServerURL();
    clipboard.writeText(url);
    return true;
  });
  
  ipcMain.handle('share-file-web', (_e, filePath: string, targetClientId?: string) => {
    return webServer()?.shareFile(filePath, targetClientId || null);
  });
  
  ipcMain.handle('unshare-file-web', (_e, fileId: string) => {
    webServer()?.unshareFile(fileId);
  });
  
  ipcMain.handle('share-text-web', (_e, text: string, targetClientId?: string) => {
    return webServer()?.shareText(text, targetClientId || null);
  });
  
  ipcMain.handle('unshare-text-web', (_e, textId: string) => {
    webServer()?.unshareText(textId);
  });
}
