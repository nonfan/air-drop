/**
 * 服务管理器 - 使用核心架构
 */
import { BrowserWindow, Notification } from 'electron';
import { ServiceAdapter } from '../../desktop/adapters/ServiceAdapter';
import { WebFileServer } from './webServer';
import { PeerDiscoveryService } from '../../core/services/discovery/PeerDiscoveryService';
import { store } from '../store';
import { addTransferRecord, addTextRecord } from '../utils/history';
import { flashWindow } from '../window';
import path from 'path';
import { APP_CONFIG } from '../config';
import { networkInterfaces } from 'os';

export interface Services {
  serviceAdapter: ServiceAdapter;
  webServer: WebFileServer;
  webServerURL: string;
  peerDiscovery?: PeerDiscoveryService;
}

/**
 * 初始化所有服务
 */
export async function initializeServices(
  downloadPath: string,
  deviceName: string,
  mainWindow: BrowserWindow | null,
  port: number = 3000
): Promise<Services> {
  console.log('[ServiceManager] Initializing services...');

  // 1. 初始化核心服务适配器
  const serviceAdapter = new ServiceAdapter(mainWindow!, deviceName, port, downloadPath);
  await serviceAdapter.initialize();

  // 2. 初始化 Web 服务器（处理移动端连接）
  const webServer = new WebFileServer(downloadPath, deviceName);
  setupWebServerEvents(webServer, mainWindow, downloadPath);

  // 使用配置文件中的端口
  await webServer.start(APP_CONFIG.PORTS.WEB_SERVER);

  console.log('[ServiceManager] Web server running at:', webServer.getURL());

  // 3. 初始化 PeerJS 设备发现服务
  let peerDiscovery: PeerDiscoveryService | undefined;
  try {
    peerDiscovery = new PeerDiscoveryService();
    
    const localIP = getLocalIP();
    await peerDiscovery.start({
      name: deviceName,
      ip: localIP,
      port: APP_CONFIG.PORTS.WEB_SERVER,
      type: 'desktop'
    });

    setupPeerDiscoveryEvents(peerDiscovery, mainWindow);
    console.log('[ServiceManager] PeerDiscovery started successfully');
  } catch (error) {
    console.error('[ServiceManager] Failed to start PeerDiscovery:', error);
  }

  console.log('[ServiceManager] All services initialized successfully');

  return {
    serviceAdapter,
    webServer,
    webServerURL: webServer.getURL(),
    peerDiscovery
  };
}

/**
 * 获取本地 IP 地址
 */
function getLocalIP(): string {
  const nets = networkInterfaces();
  const addresses: string[] = [];
  
  for (const name of Object.keys(nets)) {
    const interfaces = nets[name];
    if (!interfaces) continue;
    
    for (const net of interfaces) {
      if (net.internal) continue;
      const isIPv4 = net.family === 'IPv4' || (net.family as any) === 4;
      if (isIPv4 && net.address) {
        addresses.push(net.address);
      }
    }
  }
  
  const preferred = addresses.find(addr => addr.startsWith('192.168.'));
  if (preferred) return preferred;
  
  const fallback = addresses.find(addr => addr.startsWith('10.'));
  if (fallback) return fallback;
  
  return addresses[0] || '127.0.0.1';
}

/**
 * 设置 PeerDiscovery 事件监听
 */
function setupPeerDiscoveryEvents(
  peerDiscovery: PeerDiscoveryService,
  mainWindow: BrowserWindow | null
) {
  peerDiscovery.on('device-found', (device) => {
    console.log('[ServiceManager] Device discovered via Peer:', device);
    // 通知渲染进程
    mainWindow?.webContents.send('peer-device-found', device);
  });

  peerDiscovery.on('device-updated', (device) => {
    console.log('[ServiceManager] Device updated via Peer:', device);
    mainWindow?.webContents.send('peer-device-updated', device);
  });

  peerDiscovery.on('device-lost', (peerId) => {
    console.log('[ServiceManager] Device lost via Peer:', peerId);
    mainWindow?.webContents.send('peer-device-lost', peerId);
  });

  peerDiscovery.on('error', (error) => {
    console.error('[ServiceManager] PeerDiscovery error:', error);
  });
}

/**
 * 设置 Web 服务器事件监听
 */
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
    
    if (store.get('showNotifications')) {
      const notification = new Notification({
        title: `${APP_CONFIG.APP_NAME} - 文件接收完成`,
        body: `已接收: ${info.name}`,
        silent: false
      });
      notification.on('click', () => {
        mainWindow?.show();
        if (info.filePath) {
          require('electron').shell.showItemInFolder(info.filePath);
        }
      });
      notification.show();
    }
  });

  webServer.on('mobile-download-progress', (progress) => {
    mainWindow?.webContents.send('mobile-download-progress', progress);
  });

  webServer.on('mobile-upload-progress', (progress) => {
    mainWindow?.webContents.send('mobile-upload-progress', progress);
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
    mainWindow?.webContents.send('text-received', { 
      ...info, 
      id: textRecord.id, 
      timestamp: textRecord.timestamp 
    });
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

/**
 * 停止所有服务
 */
export async function stopAllServices(services: Partial<Services>) {
  console.log('[ServiceManager] Stopping services...');
  
  await services.serviceAdapter?.cleanup();
  services.webServer?.stop();
  services.peerDiscovery?.stop();
  
  console.log('[ServiceManager] All services stopped');
}
