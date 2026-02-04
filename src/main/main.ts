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
  
  // 创建窗口和托盘
  mainWindow = await createMainWindow();
  tray = createAppTray(mainWindow, () => {
    setWindowQuitting(true);
    setIpcQuitting(true);
    app.quit();
  });
  
  // 初始化服务
  console.log('[Main] Initializing services...');
  services = await initializeServices(downloadPath, deviceName, mainWindow);
  
  // 注册 IPC 处理器
  registerAllHandlers(
    store,
    () => mainWindow,
    () => services.serviceAdapter?.getDiscovery() || null,
    () => null, // transferServer (已移除)
    () => null, // peerTransferService (已移除)
    () => services.webServer || null,
    () => services.webServerURL || '',
    () => services.serviceAdapter || null
  );
  
  // 配置自动更新
  if (app.isPackaged) {
    setupAutoUpdater(mainWindow);
  }
  
  console.log('[Main] Application started successfully');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  setWindowQuitting(true);
  setIpcQuitting(true);
  await stopAllServices(services);
});
