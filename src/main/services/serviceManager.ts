import { BrowserWindow, Notification } from 'electron';
import { DeviceDiscovery, Device } from './discovery';
import { BroadcastDiscovery } from './broadcastDiscovery';
import { FileTransferServer } from './transfer';
import { PeerTransferService } from './peerTransfer';
import { WebFileServer } from './webServer';
import { store } from '../store';
import { addTransferRecord, addTextRecord } from '../utils/history';
import { flashWindow } from '../window';
import { NotificationManager } from '../utils/notifications';
import { EventEmitter } from 'events';
import path from 'path';
import { APP_CONFIG } from '../config';

// 通用设备发现接口
export interface IDeviceDiscovery extends EventEmitter {
  start(): Promise<void>;
  stop(): Promise<void>;
  getDevices(): Device[];
  setPeerId(peerId: string): void;
  updatePeerId(peerId: string): void; // 兼容旧代码
}

export interface Services {
  discovery: IDeviceDiscovery;
  transferServer: FileTransferServer;
  peerTransferService: PeerTransferService;
  webServer: WebFileServer;
  webServerURL: string;
}

/**
 * 初始化所有服务
 */
export async function initializeServices(
  downloadPath: string,
  deviceName: string,
  mainWindow: BrowserWindow | null
): Promise<Services> {
  // 1. 启动 PeerJS 传输服务
  const peerTransferService = await initPeerTransferService(
    downloadPath, 
    deviceName, 
    mainWindow
  );
  const peerId = peerTransferService.getPeerId();
  
  // 2. 启动 WebSocket 传输服务（备用）
  const { server: transferServer, port } = await initTransferServer(
    downloadPath, 
    deviceName, 
    mainWindow
  );
  
  // 3. 启动设备发现服务
  const discovery = await initDiscoveryService(
    deviceName, 
    port, 
    peerId, 
    mainWindow
  );
  
  // 4. 启动 Web 服务器（手机访问）
  const webServer = await initWebServer(
    downloadPath, 
    deviceName, 
    mainWindow, 
    discovery
  );
  
  return {
    discovery,
    transferServer,
    peerTransferService,
    webServer,
    webServerURL: webServer.getURL()
  };
}

/**
 * 初始化 PeerJS 传输服务
 */
async function initPeerTransferService(
  downloadPath: string,
  deviceName: string,
  mainWindow: BrowserWindow | null
): Promise<PeerTransferService> {
  const peerTransferService = new PeerTransferService(
    downloadPath, 
    deviceName, 
    (info) => handleIncomingFile(info, mainWindow, () => {
      if (store.get('autoAccept')) {
        peerTransferService.acceptTransfer(info.transferId);
      }
    })
  );
  
  setupPeerTransferEvents(peerTransferService, mainWindow);
  await peerTransferService.start();
  
  console.log('[ServiceManager] PeerJS service started with ID:', peerTransferService.getPeerId());
  return peerTransferService;
}

/**
 * 初始化 WebSocket 传输服务
 */
async function initTransferServer(
  downloadPath: string,
  deviceName: string,
  mainWindow: BrowserWindow | null
): Promise<{ server: FileTransferServer; port: number }> {
  const transferServer = new FileTransferServer(
    downloadPath, 
    deviceName, 
    (info) => handleIncomingFile(info, mainWindow, () => {
      if (store.get('autoAccept')) {
        transferServer.acceptTransfer(info.transferId);
      }
    })
  );
  
  setupTransferServerEvents(transferServer, mainWindow);
  const port = await transferServer.start();
  
  console.log('[ServiceManager] Transfer server started on port:', port);
  return { server: transferServer, port };
}

/**
 * 初始化设备发现服务
 */
async function initDiscoveryService(
  deviceName: string,
  port: number,
  peerId: string,
  mainWindow: BrowserWindow | null
): Promise<IDeviceDiscovery> {
  let discovery: IDeviceDiscovery;
  
  try {
    console.log('[ServiceManager] Trying Bonjour discovery...');
    discovery = new DeviceDiscovery(deviceName, port);
    discovery.setPeerId(peerId);
    await discovery.start();
    console.log('[ServiceManager] Bonjour discovery started successfully');
  } catch (err) {
    console.warn('[ServiceManager] Bonjour discovery failed, using broadcast:', err);
    discovery = new BroadcastDiscovery(deviceName, port);
    discovery.setPeerId(peerId);
    await discovery.start();
    console.log('[ServiceManager] Broadcast discovery started successfully');
  }
  
  return discovery;
}

/**
 * 初始化 Web 服务器
 */
async function initWebServer(
  downloadPath: string,
  deviceName: string,
  mainWindow: BrowserWindow | null,
  discovery: IDeviceDiscovery
): Promise<WebFileServer> {
  const webServer = new WebFileServer(downloadPath, deviceName);
  
  setupDiscoveryEvents(discovery, mainWindow, webServer);
  setupWebServerEvents(webServer, mainWindow, downloadPath);
  
  // 尝试端口 80，失败则使用 8080
  try {
    await webServer.start(80);
  } catch (err: any) {
    if (err.code === 'EACCES' || err.code === 'EADDRINUSE') {
      await webServer.start(8080);
    } else {
      throw err;
    }
  }
  
  console.log('[ServiceManager] Web server running at:', webServer.getURL());
  return webServer;
}

/**
 * 处理接收文件请求
 */
function handleIncomingFile(
  info: { transferId: string; senderName: string; files: any[]; totalSize: number },
  mainWindow: BrowserWindow | null,
  onAutoAccept: () => void
): void {
  mainWindow?.webContents.send('incoming-file', info);
  flashWindow(mainWindow);
  
  const fileCount = info.files.length;
  if (fileCount === 1) {
    NotificationManager.showFileReceived(info.files[0].name, info.senderName, mainWindow);
  } else {
    NotificationManager.showFilesReceived(fileCount, info.senderName, mainWindow);
  }
  
  onAutoAccept();
}

/**
 * 设置 PeerTransfer 事件监听
 */
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
