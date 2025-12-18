import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, shell, Notification, clipboard } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { DeviceDiscovery } from './services/discovery';
import { FileTransferServer } from './services/transfer';
import { WebFileServer } from './services/webServer';
import Store from 'electron-store';

interface TransferRecord {
  id: string;
  fileName: string;
  filePath: string;
  size: number;
  from: string;
  timestamp: number;
  type: 'received' | 'sent';
}

interface TextRecord {
  id: string;
  text: string;
  from: string;
  timestamp: number;
}

interface StoreSchema {
  deviceName: string;
  downloadPath: string;
  autoAccept: boolean;
  showNotifications: boolean;
  transferHistory: TransferRecord[];
  textHistory: TextRecord[];
}

const store = new Store<StoreSchema>({
  defaults: {
    deviceName: `WinDrop-${Math.random().toString(36).slice(2, 6)}`,
    downloadPath: '',
    autoAccept: false,
    showNotifications: true,
    transferHistory: [],
    textHistory: []
  }
});

function addTransferRecord(record: Omit<TransferRecord, 'id' | 'timestamp'>) {
  const history = store.get('transferHistory') || [];
  const newRecord: TransferRecord = {
    ...record,
    id: Math.random().toString(36).slice(2, 10),
    timestamp: Date.now()
  };
  // Keep last 50 records
  const updated = [newRecord, ...history].slice(0, 50);
  store.set('transferHistory', updated);
  mainWindow?.webContents.send('transfer-history-updated', updated);
  return newRecord;
}

function addTextRecord(record: Omit<TextRecord, 'id' | 'timestamp'>) {
  const history = store.get('textHistory') || [];
  const newRecord: TextRecord = {
    ...record,
    id: Math.random().toString(36).slice(2, 10),
    timestamp: Date.now()
  };
  // Keep last 30 text records
  const updated = [newRecord, ...history].slice(0, 30);
  store.set('textHistory', updated);
  mainWindow?.webContents.send('text-history-updated', updated);
  return newRecord;
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let discovery: DeviceDiscovery | null = null;
let transferServer: FileTransferServer | null = null;
let webServer: WebFileServer | null = null;

let deviceName: string;
let downloadPath: string;
let webServerURL: string = '';

async function createWindow() {
  const iconPath = path.join(__dirname, '../../public/icon.ico');
  
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    frame: false,
    transparent: true,
    resizable: true,
    minWidth: 900,
    minHeight: 550,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    // Try multiple ports in case one is in use
    const tryPorts = [5173, 5174, 5175];
    let loaded = false;
    for (const port of tryPorts) {
      try {
        await mainWindow.loadURL(`http://localhost:${port}`);
        loaded = true;
        break;
      } catch {
        continue;
      }
    }
    if (!loaded) {
      console.error('Could not connect to dev server');
    }
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow?.hide();
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../../public/icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开 Airdrop', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '退出', click: () => { app.quit(); process.exit(0); } }
  ]);
  
  tray.setToolTip('Airdrop - 文件传输');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());
}


async function initServices() {
  transferServer = new FileTransferServer(downloadPath, deviceName, (info: { transferId: string; senderName: string; files: { name: string; size: number }[]; totalSize: number }) => {
    mainWindow?.webContents.send('incoming-file', info);
    
    // Show notification
    if (store.get('showNotifications')) {
      const notification = new Notification({
        title: 'WinDrop - 收到文件',
        body: `${info.senderName} 想要发送 ${info.files.length} 个文件`,
        silent: false
      });
      notification.on('click', () => mainWindow?.show());
      notification.show();
    }
    
    // Auto accept if enabled
    if (store.get('autoAccept')) {
      transferServer?.acceptTransfer(info.transferId);
    }
  });
  
  // Transfer progress events
  transferServer.on('transfer-progress', (progress: { transferId: string; percent: number; currentFile: string }) => {
    mainWindow?.webContents.send('transfer-progress', progress);
  });
  
  transferServer.on('transfer-complete', (result: { transferId: string; success: boolean; files?: { name: string; path: string; size: number }[]; senderName?: string }) => {
    mainWindow?.webContents.send('transfer-complete', result);
    // Add received files to history
    if (result.files) {
      for (const file of result.files) {
        addTransferRecord({
          fileName: file.name,
          filePath: file.path,
          size: file.size,
          from: result.senderName || '未知设备',
          type: 'received'
        });
      }
    }
    if (store.get('showNotifications')) {
      new Notification({
        title: 'WinDrop',
        body: '文件接收完成！'
      }).show();
    }
  });
  
  transferServer.on('send-progress', (progress: { percent: number; currentFile: string }) => {
    mainWindow?.webContents.send('send-progress', progress);
  });
  
  transferServer.on('send-complete', (result: { success: boolean; reason?: string }) => {
    mainWindow?.webContents.send('send-complete', result);
  });
  
  const port = await transferServer.start();
  
  discovery = new DeviceDiscovery(deviceName, port);
  discovery.on('device-found', (device) => {
    mainWindow?.webContents.send('device-found', device);
  });
  discovery.on('device-lost', (deviceId) => {
    mainWindow?.webContents.send('device-lost', deviceId);
  });
  
  await discovery.start();

  // Start Web Server for mobile access
  webServer = new WebFileServer(downloadPath, deviceName);
  
  webServer.on('upload-start', (info: { name: string; size: number; clientName?: string }) => {
    mainWindow?.webContents.send('web-upload-start', info);
    if (store.get('showNotifications')) {
      new Notification({
        title: 'WinDrop',
        body: `正在接收来自 ${info.clientName || '手机'} 的文件: ${info.name}`
      }).show();
    }
  });

  webServer.on('upload-progress', (progress: { name: string; percent: number }) => {
    mainWindow?.webContents.send('web-upload-progress', progress);
  });

  webServer.on('upload-complete', (info: { name: string; size: number; filePath?: string; clientName?: string }) => {
    mainWindow?.webContents.send('web-upload-complete', info);
    // Add to transfer history
    addTransferRecord({
      fileName: info.name,
      filePath: info.filePath || path.join(downloadPath, info.name),
      size: info.size,
      from: info.clientName || '手机',
      type: 'received'
    });
    if (store.get('showNotifications')) {
      new Notification({
        title: 'WinDrop',
        body: `文件接收完成: ${info.name}`
      }).show();
    }
  });

  // 手机连接/断开事件
  webServer.on('client-connected', (client: { id: string; name: string; ip: string }) => {
    mainWindow?.webContents.send('mobile-connected', client);
    if (store.get('showNotifications')) {
      new Notification({ title: 'WinDrop', body: `手机已连接: ${client.name}` }).show();
    }
  });

  webServer.on('client-disconnected', (client: { id: string; name: string; ip: string }) => {
    mainWindow?.webContents.send('mobile-disconnected', client);
  });

  // 手机更新名称
  webServer.on('client-updated', (client: { id: string; name: string; ip: string }) => {
    mainWindow?.webContents.send('mobile-updated', client);
  });

  // 手机下载完成后通知前端移除分享记录
  webServer.on('file-downloaded', (info: { id: string; name: string; size: number }) => {
    mainWindow?.webContents.send('file-downloaded', info);
    if (store.get('showNotifications')) {
      new Notification({
        title: 'WinDrop',
        body: `手机已下载: ${info.name}`
      }).show();
    }
  });

  // 手机发送文本到电脑
  webServer.on('text-received', (info: { text: string; clientId: string; clientName: string }) => {
    // 保存到文本历史
    const textRecord = addTextRecord({ text: info.text, from: info.clientName });
    mainWindow?.webContents.send('text-received', { ...info, id: textRecord.id, timestamp: textRecord.timestamp });
    // 自动复制到剪贴板
    clipboard.writeText(info.text);
    if (store.get('showNotifications')) {
      new Notification({
        title: 'WinDrop - 收到文本',
        body: `来自 ${info.clientName}: ${info.text.slice(0, 50)}${info.text.length > 50 ? '...' : ''}`
      }).show();
    }
  });

  // 手机复制了分享的文本
  webServer.on('text-copied', (info: { id: string; text: string; clientId: string }) => {
    mainWindow?.webContents.send('text-copied', info);
  });

  await webServer.start(80);
  webServerURL = webServer.getURL();
  console.log(`Web server running at ${webServerURL}`);
}

// IPC Handlers
ipcMain.handle('get-devices', () => discovery?.getDevices() || []);
ipcMain.handle('get-device-name', () => store.get('deviceName'));
ipcMain.handle('set-device-name', (_e, name: string) => {
  store.set('deviceName', name);
});

ipcMain.handle('get-settings', () => ({
  deviceName: store.get('deviceName'),
  downloadPath: store.get('downloadPath'),
  autoAccept: store.get('autoAccept'),
  showNotifications: store.get('showNotifications')
}));

ipcMain.handle('set-settings', (_e, settings: Partial<StoreSchema>) => {
  if (settings.deviceName) store.set('deviceName', settings.deviceName);
  if (settings.downloadPath) {
    store.set('downloadPath', settings.downloadPath);
    transferServer?.setDownloadPath(settings.downloadPath);
  }
  if (typeof settings.autoAccept === 'boolean') store.set('autoAccept', settings.autoAccept);
  if (typeof settings.showNotifications === 'boolean') store.set('showNotifications', settings.showNotifications);
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections']
  });
  return result.filePaths;
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory']
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('send-files', async (_e, { deviceId, files }: { deviceId: string; files: string[] }) => {
  const device = discovery?.getDevices().find(d => d.id === deviceId);
  if (!device) throw new Error('Device not found');
  return transferServer?.sendFiles(device.ip, device.port, files);
});

ipcMain.handle('accept-transfer', (_e, transferId: string) => {
  transferServer?.acceptTransfer(transferId);
});

ipcMain.handle('reject-transfer', (_e, transferId: string) => {
  transferServer?.rejectTransfer(transferId);
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

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => mainWindow?.hide());

// Web server IPC
ipcMain.handle('get-web-url', () => webServerURL);
ipcMain.handle('copy-web-url', () => {
  clipboard.writeText(webServerURL);
  return true;
});
ipcMain.handle('share-file-web', (_e, filePath: string, targetClientId?: string) => {
  return webServer?.shareFile(filePath, targetClientId || null);
});

ipcMain.handle('get-mobile-clients', () => {
  return webServer?.getConnectedClients() || [];
});
ipcMain.handle('unshare-file-web', (_e, fileId: string) => {
  webServer?.unshareFile(fileId);
});
ipcMain.handle('share-text-web', (_e, text: string, targetClientId?: string) => {
  return webServer?.shareText(text, targetClientId || null);
});
ipcMain.handle('unshare-text-web', (_e, textId: string) => {
  webServer?.unshareText(textId);
});
ipcMain.handle('get-clipboard-text', () => {
  return clipboard.readText();
});

// Transfer history IPC
ipcMain.handle('get-transfer-history', () => store.get('transferHistory') || []);
ipcMain.handle('clear-transfer-history', () => {
  store.set('transferHistory', []);
  return [];
});

// Text history IPC
ipcMain.handle('get-text-history', () => store.get('textHistory') || []);
ipcMain.handle('clear-text-history', () => {
  store.set('textHistory', []);
  return [];
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

app.whenReady().then(async () => {
  deviceName = store.get('deviceName');
  downloadPath = store.get('downloadPath') || app.getPath('downloads');
  store.set('downloadPath', downloadPath);
  
  await createWindow();
  createTray();
  await initServices();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  discovery?.stop();
  transferServer?.stop();
  webServer?.stop();
});
