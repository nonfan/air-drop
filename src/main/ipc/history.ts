// IPC 处理器 - 历史记录相关
import { ipcMain } from 'electron';
import Store from 'electron-store';
import type { StoreSchema } from '../store';

export function registerHistoryHandlers(store: Store<StoreSchema>) {
  ipcMain.handle('get-transfer-history', () => store.get('transferHistory') || []);
  
  ipcMain.handle('clear-transfer-history', () => {
    store.set('transferHistory', []);
    return [];
  });
  
  ipcMain.handle('get-text-history', () => store.get('textHistory') || []);
  
  ipcMain.handle('clear-text-history', () => {
    store.set('textHistory', []);
    return [];
  });
}
