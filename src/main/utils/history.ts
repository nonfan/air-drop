import { BrowserWindow } from 'electron';
import { store, TransferRecord, TextRecord } from '../store';

export function addTransferRecord(
  record: Omit<TransferRecord, 'id' | 'timestamp'>,
  mainWindow: BrowserWindow | null
): TransferRecord {
  const history = store.get('transferHistory') || [];
  const newRecord: TransferRecord = {
    ...record,
    id: Math.random().toString(36).slice(2, 10),
    timestamp: Date.now()
  };
  const updated = [newRecord, ...history].slice(0, 50);
  store.set('transferHistory', updated);
  mainWindow?.webContents.send('transfer-history-updated', updated);
  return newRecord;
}

export function addTextRecord(
  record: Omit<TextRecord, 'id' | 'timestamp'>,
  mainWindow: BrowserWindow | null
): TextRecord {
  const history = store.get('textHistory') || [];
  const newRecord: TextRecord = {
    ...record,
    id: Math.random().toString(36).slice(2, 10),
    timestamp: Date.now()
  };
  const updated = [newRecord, ...history].slice(0, 30);
  store.set('textHistory', updated);
  mainWindow?.webContents.send('text-history-updated', updated);
  return newRecord;
}
