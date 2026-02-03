/**
 * 本地存储相关工具函数
 */

/**
 * 从 localStorage 读取 JSON 数据
 * @param key 存储键
 * @param defaultValue 默认值
 * @returns 解析后的数据或默认值
 */
export function getStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error(`Failed to parse ${key}:`, e);
  }
  return defaultValue;
}

/**
 * 保存数据到 localStorage
 * @param key 存储键
 * @param value 要保存的数据
 */
export function setStorageItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to save ${key}:`, e);
  }
}

/**
 * 从 localStorage 删除数据
 * @param key 存储键
 */
export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.error(`Failed to remove ${key}:`, e);
  }
}

// 存储键常量
export const STORAGE_KEYS = {
  SETTINGS: 'windrop-settings',
  HISTORY: 'windrop-history',
  LAST_DEVICE: 'windrop-last-device',
  DOWNLOADED_IDS: 'windrop-downloaded-ids',
  DOWNLOAD_FAILED_IDS: 'windrop-download-failed-ids',
  LAST_SERVER_URL: 'windrop-last-server-url',
  MANUAL_SERVER_IP: 'windrop-manual-server-ip', // 手动配置的服务器 IP
} as const;
