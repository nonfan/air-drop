import { app, BrowserWindow } from 'electron';
import * as path from 'path';

let isQuitting = false;

export function setIsQuitting(value: boolean) {
  isQuitting = value;
}

export async function createMainWindow(): Promise<BrowserWindow> {
  const iconPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '../../public/icon.ico');
  
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    frame: false,
    transparent: true,
    resizable: true,
    minWidth: 900,
    minHeight: 650,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  console.log('[Window] Environment:', process.env.NODE_ENV);
  console.log('[Window] isDev:', isDev);
  
  if (isDev) {
    // ⚠️ 端口配置：修改此端口时必须同步更新
    // 1. package.json - dev:electron 中的 wait-on URL
    // 2. vite.config.ts - server.port
    const VITE_DEV_PORT = 5173;
    const VITE_DEV_URL = `http://localhost:${VITE_DEV_PORT}`;
    
    // 等待 Vite 开发服务器启动
    const maxRetries = 30;
    const retryDelay = 500;
    let loaded = false;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await mainWindow.loadURL(VITE_DEV_URL);
        loaded = true;
        console.log('[Window] Successfully connected to Vite dev server');
        break;
      } catch (error) {
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    if (!loaded) {
      console.error('[Window] Failed to connect to Vite dev server after', maxRetries, 'attempts');
      console.error('[Window] Please ensure Vite is running on', VITE_DEV_URL);
    }
    
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const htmlPath = path.join(__dirname, '../../renderer/index.html');
    console.log('[Window] Loading file from:', htmlPath);
    console.log('[Window] __dirname:', __dirname);
    console.log('[Window] File exists:', require('fs').existsSync(htmlPath));
    
    try {
      await mainWindow.loadFile(htmlPath);
      console.log('[Window] File loaded successfully');
    } catch (error) {
      console.error('[Window] Failed to load file:', error);
    }
  }

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  return mainWindow;
}

export function flashWindow(mainWindow: BrowserWindow | null) {
  if (mainWindow && !mainWindow.isFocused()) {
    mainWindow.flashFrame(true);
  }
}
