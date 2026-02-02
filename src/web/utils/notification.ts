/**
 * 通知相关工具函数
 */

/**
 * 请求通知权限
 */
export async function requestNotificationPermission(): Promise<void> {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

/**
 * 显示系统通知
 * @param title 通知标题
 * @param body 通知内容
 * @param icon 通知图标
 */
export function showSystemNotification(title: string, body: string, icon?: string): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon });
  }
}

/**
 * 检查是否支持通知
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

/**
 * 检查通知权限状态
 */
export function getNotificationPermission(): NotificationPermission | null {
  if ('Notification' in window) {
    return Notification.permission;
  }
  return null;
}
