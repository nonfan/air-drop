import { app, BrowserWindow, Tray } from 'electron';
import { store } from './store';
import { createMainWindow, setIsQuitting as setWindowQuitting } from './window';
import { createAppTray } from './tray';
import { initializeServices, stopAllServices, Services } from './services/serviceManager';
import { setupAutoUpdater } from './updater';
import { registerAllHandlers, setIsQuitting as setIpcQuitting } from './ipc';

// 全局变量
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let services: Partial<Services> = {};

// 应用启动
app.whenReady().then(async () => {
  const deviceName = store.get('deviceName');
  const downloadPath = store.get('downloadPath') || app.getPath('downloads');
  store.set('downloadPath', downloadPath);
  
  // 先注册 IPC 处理器（在创建窗口之前）
  // 使用临时的空函数，稍后会被实际服务替换
  registerAllHandlers(
    store,
    () => mainWindow,
    () => services.discovery || null,
    () => services.transferServer || null,
    () => services.peerTransferService || null,
    () => services.webServer || null,
    () => services.webServerURL || ''
  );
  
  // 创建窗口和托盘
  mainWindow = await createMainWindow();
  tray = createAppTray(mainWindow, () => {
    setWindowQuitting(true);
    setIpcQuitting(true);
    app.quit();
  });
  
  // 初始化服务
  services = await initializeServices(downloadPath, deviceName, mainWindow);
  
  // 配置自动更新
  if (app.isPackaged) {
    setupAutoUpdater(mainWindow);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  setWindowQuitting(true);
  setIpcQuitting(true);
  stopAllServices(services);
});
