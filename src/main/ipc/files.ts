// IPC 处理器 - 文件相关
import { ipcMain, dialog, shell, clipboard, nativeImage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import Store from 'electron-store';
import type { DiscoveryService } from '../../core/services/discovery/DiscoveryService';
import type { WebFileServer } from '../services/webServer';

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

import type { ServiceAdapter } from '../../desktop/adapters/ServiceAdapter';

export function registerFileHandlers(
  store: Store<StoreSchema>,
  getMainWindow: () => Electron.BrowserWindow | null,
  discovery: () => DiscoveryService | null,
  _transferServer: () => null, // 已移除
  _peerTransferService: () => null, // 已移除
  webServer: () => WebFileServer | null,
  serviceAdapter: () => ServiceAdapter | null
) {
  ipcMain.handle('select-files', async () => {
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      properties: ['openFile', 'multiSelections']
    });
    return result.filePaths;
  });

  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(getMainWindow()!, {
      properties: ['openDirectory']
    });
    return result.filePaths[0] || null;
  });

  ipcMain.handle('send-files', async (_e, { deviceId, files }: { deviceId: string; files: string[] }) => {
    const device = discovery()?.getDevices().find(d => d.id === deviceId);
    if (!device) throw new Error('Device not found');
    
    const adapter = serviceAdapter();
    if (!adapter) throw new Error('Service adapter not initialized');
    
    try {
      // 使用新架构发送文件
      const transferIds = await adapter.sendFiles(deviceId, files);
      
      console.log('[IPC] Files sent successfully:', transferIds);
      
      return {
        success: true,
        transferIds,
        message: `Started ${files.length} transfer(s)`
      };
    } catch (error: any) {
      console.error('[IPC] Failed to send files:', error);
      throw new Error(`Failed to send files: ${error.message}`);
    }
  });

  ipcMain.handle('accept-transfer', (_e, transferId: string) => {
    const adapter = serviceAdapter();
    if (!adapter) throw new Error('Service adapter not initialized');
    
    adapter.acceptTransfer(transferId);
    return { success: true };
  });

  ipcMain.handle('reject-transfer', (_e, transferId: string) => {
    const adapter = serviceAdapter();
    if (!adapter) throw new Error('Service adapter not initialized');
    
    adapter.rejectTransfer(transferId);
    return { success: true };
  });

  ipcMain.handle('open-download-folder', () => {
    shell.openPath(store.get('downloadPath'));
  });

  ipcMain.handle('get-file-info', (_e, filePath: string) => {
    try {
      const stats = fs.statSync(filePath);
      return {
        name: path.basename(filePath),
        size: stats.size,
        path: filePath
      };
    } catch {
      return null;
    }
  });

  ipcMain.handle('open-file', (_e, filePath: string) => {
    if (fs.existsSync(filePath)) {
      shell.openPath(filePath);
      return true;
    }
    return false;
  });

  ipcMain.handle('show-file-in-folder', (_e, filePath: string) => {
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  });

  ipcMain.handle('copy-image-to-clipboard', (_e, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        const image = nativeImage.createFromPath(filePath);
        if (!image.isEmpty()) {
          clipboard.writeImage(image);
          console.log('Image copied to clipboard:', filePath);
          return true;
        } else {
          console.error('Image is empty:', filePath);
        }
      } else {
        console.error('File does not exist:', filePath);
      }
      return false;
    } catch (error) {
      console.error('Failed to copy image:', error);
      return false;
    }
  });

  ipcMain.handle('get-clipboard-text', () => {
    return clipboard.readText();
  });

  ipcMain.handle('copy-text', (_e, text: string) => {
    try {
      clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy text:', error);
      return false;
    }
  });

  ipcMain.handle('get-clipboard-files', async () => {
    const formats = clipboard.availableFormats();
    
    if (formats.includes('image/png') || formats.includes('image/jpeg')) {
      const image = clipboard.readImage();
      if (!image.isEmpty()) {
        const tempDir = require('electron').app.getPath('temp');
        const fileName = `clipboard_${Date.now()}.png`;
        const filePath = path.join(tempDir, fileName);
        fs.writeFileSync(filePath, image.toPNG());
        return [{ name: fileName, size: fs.statSync(filePath).size, path: filePath }];
      }
    }
    
    if (process.platform === 'win32') {
      const text = clipboard.readBuffer('FileNameW');
      if (text && text.length > 0) {
        const paths = text.toString('utf16le').split('\0').filter(p => p && fs.existsSync(p));
        if (paths.length > 0) {
          return paths.map(p => ({
            name: path.basename(p),
            size: fs.statSync(p).size,
            path: p
          }));
        }
      }
    }
    
    return [];
  });
}
