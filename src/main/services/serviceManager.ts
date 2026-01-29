import { BrowserWindow, Notification } from 'electron';
import * as path from 'path';
import { DeviceDiscovery, Device } from './discovery';
import { BroadcastDiscovery } from './broadcastDiscovery';
import { FileTransferServer } from './transfer';
import { PeerTransferService } from './peerTransfer';
import { WebFileServer } from './webServer';
import { store } from '../store';
import { APP_CONFIG } from '../config';
import { addTransferRecord, addTextRecord } from '../utils/history';
import { flashWindow } from '../window';
import { EventEmitter } from 'events';

// 通用设备发现接口
export interface IDeviceDiscovery extends EventEmitter {
  start(peerId?: string): Promise<void>;
  stop(): void;
  getDevices(): Device[];
  updatePeerId(peerId: string): void;
}

export interface Services {
  discovery: IDeviceDiscovery;
  transferServer: FileTransferServer;
  peerTransferService: PeerTransferService;
  webServer: WebFileServer;
  webServerURL: string;
}

export async function initializeServices(
  downloadPath: string,
  deviceName: string,
  mainWindow: BrowserWindow | null
): Promise<Services> {
  // PeerJS 传输服务
  const peerTransferService = new PeerTransferService(downloadPath, deviceName, (info) => {
    mainWindow?.webContents.send('incoming-file', info);
    flashWindow(mainWindow);
    
    if (store.get('showNotifications')) {
      const fileCount = info.files.length;
      const notification = new Notification({
        title: `${APP_CONFIG.APP_NAME} - 收到文件`,
        body: fileCount === 1 
          ? `${info.senderName} 发送了: ${info.files[0].name}` 
          : `${info.senderName} 发送了 ${fileCount} 个文件`,
        silent: false
      });
      notification.on('click', () => mainWindow?.show());
      notification.show();
    }
    
    if (store.get('autoAccept')) {
      peerTransferService.acceptTransfer(info.transferId);
    }
  });
  
  setupPeerTransferEvents(peerTransferService, mainWindow);
  await peerTransferService.start();
  const peerId = peerTransferService.getPeerId();
  console.log('PeerJS service started with ID:', peerId);
  
  // WebSocket 传输服务（备用）
  const transferServer = new FileTransferServer(downloadPath, deviceName, (info) => {
    mainWindow?.webContents.send('incoming-file', info);
    flashWindow(mainWindow);
    
    if (store.get('showNotifications')) {
      const fileCount = info.files.length;
      const notification = new Notification({
        title: `${APP_CONFIG.APP_NAME} - 收到文件`,
        body: fileCount === 1 
          ? `${info.senderName} 发送了: ${info.files[0].name}` 
          : `${info.senderName} 发送了 ${fileCount} 个文件`,
        silent: false
      });
      notification.on('click', () => mainWindow?.show());
      notification.show();
    }
    
    if (store.get('autoAccept')) {
      transferServer.acceptTransfer(info.transferId);
    }
  });
  
  setupTransferServerEvents(transferServer, mainWindow);
  const port = await transferServer.start();
  
  // 设备发现服务（优先使用 Bonjour，失败则使用广播）
  let discovery: IDeviceDiscovery;
  const webServer = new WebFileServer(downloadPath, deviceName);
  
  try {
    console.log('[ServiceManager] Trying Bonjour discovery...');
    discovery = new DeviceDiscovery(deviceName, port);
    setupDiscoveryEvents(discovery, mainWindow, webServer);
    await discovery.start(peerId);
    console.log('[ServiceManager] Bonjour discovery started successfully');
  } catch (err) {
    console.warn('[ServiceManager] Bonjour discovery failed, using broadcast discovery:', err);
    discovery = new BroadcastDiscovery(deviceName, port);
    setupDiscoveryEvents(discovery, mainWindow, webServer);
    await discovery.start(peerId);
    console.log('[ServiceManager] Broadcast discovery started successfully');
  }

  // Web 服务器（手机访问）
  setupWebServerEvents(webServer, mainWindow, downloadPath);
  
  try {
    await webServer.start(80);
  } catch (err: any) {
    if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
      await webServer.start(8080);
    } else {
      throw err;
    }
  }
  
  const webServerURL = webServer.getURL();
  console.log(`Web server running at ${webServerURL}`);

  return {
    discovery,
    transferServer,
    peerTransferService,
    webServer,
    webServerURL
  };
}

function setupPeerTransferEvents(
  peerTransferService: PeerTransferService,
  mainWindow: BrowserWindow | null
) {
  peerTransferService.on('transfer-progress', (progress) => {
    mainWindow?.webContents.send('transfer-progress', progress);
  });
  
  peerTransferService.on('transfer-complete', (result) => {
    mainWindow?.webContents.send('transfer-complete', result);
    flashWindow(mainWindow);
    
    if (result.success && result.files) {
      for (const file of result.files) {
        addTransferRecord({
          fileName: file.name,
          filePath: file.path,
          size: file.size,
          from: result.senderName || '未知设备',
          type: 'received'
        }, mainWindow);
      }
    }
  });
  
  peerTransferService.on('send-progress', (progress) => {
    mainWindow?.webContents.send('send-progress', progress);
  });
  
  peerTransferService.on('send-complete', (result) => {
    mainWindow?.webContents.send('send-complete', result);
  });
}

function setupTransferServerEvents(
  transferServer: FileTransferServer,
  mainWindow: BrowserWindow | null
) {
  transferServer.on('transfer-progress', (progress) => {
    mainWindow?.webContents.send('transfer-progress', progress);
  });
  
  transferServer.on('transfer-complete', (result) => {
    mainWindow?.webContents.send('transfer-complete', result);
    flashWindow(mainWindow);
    
    if (result.success && result.files) {
      for (const file of result.files) {
        addTransferRecord({
          fileName: file.name,
          filePath: file.path,
          size: file.size,
          from: result.senderName || '未知设备',
          type: 'received'
        }, mainWindow);
      }
    }
  });
  
  transferServer.on('send-progress', (progress) => {
    mainWindow?.webContents.send('send-progress', progress);
  });
  
  transferServer.on('send-complete', (result) => {
    mainWindow?.webContents.send('send-complete', result);
  });
}

function setupDiscoveryEvents(
  discovery: IDeviceDiscovery,
  mainWindow: BrowserWindow | null,
  webServer: WebFileServer
) {
  discovery.on('device-found', (device: Device) => {
    console.log('[ServiceManager] Device found event:', device.name, device.ip);
    mainWindow?.webContents.send('device-found', device);
    webServer.updateLANDevice({ ...device, type: 'pc' });
  });
  
  discovery.on('device-lost', (deviceId: string) => {
    console.log('[ServiceManager] Device lost event:', deviceId);
    mainWindow?.webContents.send('device-lost', deviceId);
    webServer.removeLANDevice(deviceId);
  });
}

function setupWebServerEvents(
  webServer: WebFileServer,
  mainWindow: BrowserWindow | null,
  downloadPath: string
) {
  webServer.on('upload-start', (info) => {
    mainWindow?.webContents.send('web-upload-start', info);
    flashWindow(mainWindow);
    
    if (store.get('showNotifications')) {
      const notification = new Notification({
        title: `${APP_CONFIG.APP_NAME} - 收到文件`,
        body: `${info.clientName || '手机'} 发送了: ${info.name}`,
        silent: false
      });
      notification.on('click', () => mainWindow?.show());
      notification.show();
    }
  });

  webServer.on('upload-progress', (progress) => {
    mainWindow?.webContents.send('web-upload-progress', progress);
  });

  webServer.on('upload-complete', (info) => {
    mainWindow?.webContents.send('web-upload-complete', info);
    flashWindow(mainWindow);
    
    addTransferRecord({
      fileName: info.name,
      filePath: info.filePath || path.join(downloadPath, info.name),
      size: info.size,
      from: info.clientName || '手机',
      type: 'received'
    }, mainWindow);
    
    // 文件接收完成通知
    if (store.get('showNotifications')) {
      const notification = new Notification({
        title: `${APP_CONFIG.APP_NAME} - 文件接收完成`,
        body: `已接收: ${info.name}`,
        silent: false
      });
      notification.on('click', () => {
        mainWindow?.show();
        // 可选：打开文件所在文件夹
        if (info.filePath) {
          require('electron').shell.showItemInFolder(info.filePath);
        }
      });
      notification.show();
    }
  });

  webServer.on('client-connected', (client) => {
    mainWindow?.webContents.send('mobile-connected', client);
  });

  webServer.on('client-disconnected', (client) => {
    mainWindow?.webContents.send('mobile-disconnected', client);
  });

  webServer.on('client-updated', (client) => {
    mainWindow?.webContents.send('mobile-updated', client);
  });

  webServer.on('file-downloaded', (info) => {
    mainWindow?.webContents.send('file-downloaded', info);
    if (store.get('showNotifications')) {
      new Notification({
        title: APP_CONFIG.APP_NAME,
        body: `手机已下载: ${info.name}`
      }).show();
    }
  });

  webServer.on('text-received', (info) => {
    const textRecord = addTextRecord({ text: info.text, from: info.clientName }, mainWindow);
    mainWindow?.webContents.send('text-received', { ...info, id: textRecord.id, timestamp: textRecord.timestamp });
    flashWindow(mainWindow);
    require('electron').clipboard.writeText(info.text);
    
    if (store.get('showNotifications')) {
      const notification = new Notification({
        title: `${APP_CONFIG.APP_NAME} - 收到文本`,
        body: `来自 ${info.clientName}: ${info.text.slice(0, 50)}${info.text.length > 50 ? '...' : ''}`,
        silent: false
      });
      notification.on('click', () => mainWindow?.show());
      notification.show();
    }
  });

  webServer.on('text-copied', (info) => {
    mainWindow?.webContents.send('text-copied', info);
  });

  webServer.on('download-failed', (info) => {
    mainWindow?.webContents.send('web-download-failed', info);
  });
}

export function stopAllServices(services: Partial<Services>) {
  services.discovery?.stop();
  services.transferServer?.stop();
  services.peerTransferService?.stop();
  services.webServer?.stop();
}
