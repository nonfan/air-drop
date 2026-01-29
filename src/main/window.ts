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
  if (isDev) {
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
