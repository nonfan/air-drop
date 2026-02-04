/**
 * 服务管理器 - 使用核心架构
 */
import { BrowserWindow, Notification } from 'electron';
import { ServiceAdapter } from '../../desktop/adapters/ServiceAdapter';
import { WebFileServer } from './webServer';
import { store } from '../store';
import { addTransferRecord, addTextRecord } from '../utils/history';
import { flashWindow } from '../window';
import path from 'path';
import { APP_CONFIG } from '../config';

export interface Services {
  serviceAdapter: ServiceAdapter;
  webServer: WebFileServer;
  webServerURL: string;
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
  const { APP_CONFIG } = await import('../config');
  await webServer.start(APP_CONFIG.PORTS.WEB_SERVER);

  console.log('[ServiceManager] Web server running at:', webServer.getURL());
  console.log('[ServiceManager] All services initialized successfully');

  return {
    serviceAdapter,
    webServer,
    webServerURL: webServer.getURL()
  };
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
  
  console.log('[ServiceManager] All services stopped');
}
