import { BrowserWindow, Notification } from 'electron';
import { APP_CONFIG } from '../config';
import { store } from '../store';

/**
 * 通知管理器
 */
export class NotificationManager {
  /**
   * 显示通知（如果用户启用了通知）
   */
  static show(
    title: string, 
    body: string, 
    options?: {
      silent?: boolean;
      onClick?: () => void;
    }
  ): void {
    if (!store.get('showNotifications')) {
      return;
    }

    const notification = new Notification({
      title: `${APP_CONFIG.APP_NAME} - ${title}`,
      body,
      silent: options?.silent ?? false
    });

    if (options?.onClick) {
      notification.on('click', options.onClick);
    }

    notification.show();
  }

  /**
   * 显示文件接收通知
   */
  static showFileReceived(
    fileName: string, 
    from: string, 
    mainWindow: BrowserWindow | null
  ): void {
    this.show('收到文件', `${from} 发送了: ${fileName}`, {
      onClick: () => mainWindow?.show()
    });
  }

  /**
   * 显示多文件接收通知
   */
  static showFilesReceived(
    fileCount: number, 
    from: string, 
    mainWindow: BrowserWindow | null
  ): void {
    this.show('收到文件', `${from} 发送了 ${fileCount} 个文件`, {
      onClick: () => mainWindow?.show()
    });
  }

  /**
   * 显示文本接收通知
   */
  static showTextReceived(
    text: string, 
    from: string, 
    mainWindow: BrowserWindow | null
  ): void {
    const preview = text.length > 50 ? `${text.slice(0, 50)}...` : text;
    this.show('收到文本', `来自 ${from}: ${preview}`, {
      onClick: () => mainWindow?.show()
    });
  }

  /**
   * 显示文件下载完成通知
   */
  static showFileDownloaded(fileName: string): void {
    this.show('文件下载完成', `手机已下载: ${fileName}`);
  }

  /**
   * 显示传输完成通知
   */
  static showTransferComplete(
    fileName: string, 
    filePath: string,
    mainWindow: BrowserWindow | null
  ): void {
    this.show('文件接收完成', `已接收: ${fileName}`, {
      onClick: () => {
        mainWindow?.show();
        require('electron').shell.showItemInFolder(filePath);
      }
    });
  }
}
