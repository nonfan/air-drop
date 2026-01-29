import { app, Tray, Menu, nativeImage, BrowserWindow } from 'electron';
import * as path from 'path';

export function createAppTray(
  mainWindow: BrowserWindow | null,
  onQuit: () => void
): Tray {
  const iconPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'icon.ico')
    : path.join(__dirname, '../../public/icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  const tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '打开 Airdrop', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: '退出', click: onQuit }
  ]);
  
  tray.setToolTip('Airdrop - 文件传输');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => mainWindow?.show());

  return tray;
}
