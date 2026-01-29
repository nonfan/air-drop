import Store from 'electron-store';
import { generateDeviceName } from './config';

export interface TransferRecord {
  id: string;
  fileName: string;
  filePath: string;
  size: number;
  from: string;
  timestamp: number;
  type: 'received' | 'sent';
}

export interface TextRecord {
  id: string;
  text: string;
  from: string;
  timestamp: number;
}

export interface StoreSchema {
  deviceName: string;
  downloadPath: string;
  autoAccept: boolean;
  showNotifications: boolean;
  theme: 'system' | 'dark' | 'light';
  autoLaunch: boolean;
  transferHistory: TransferRecord[];
  textHistory: TextRecord[];
}

export const store = new Store<StoreSchema>({
  defaults: {
    deviceName: generateDeviceName(),
    downloadPath: '',
    autoAccept: false,
    showNotifications: true,
    theme: 'system',
    autoLaunch: false,
    transferHistory: [],
    textHistory: []
  }
});
