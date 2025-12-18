/**
 * 应用全局配置
 * 修改此文件可全局更改应用名称、标识等
 */

export const APP_CONFIG = {
  // 应用名称
  APP_NAME: 'Airdrop',
  
  // 应用 ID（用于 mDNS 服务发现）
  SERVICE_TYPE: 'airdrop',
  
  // 默认设备名前缀
  DEVICE_NAME_PREFIX: 'Airdrop',
  
  // localStorage 键名前缀
  STORAGE_PREFIX: 'airdrop',
  
  // 版本号
  VERSION: '1.0.0',
} as const;

// 生成默认设备名
export function generateDeviceName(): string {
  return `${APP_CONFIG.DEVICE_NAME_PREFIX}-${Math.random().toString(36).slice(2, 6)}`;
}

// 获取 localStorage 键名
export function getStorageKey(key: string): string {
  return `${APP_CONFIG.STORAGE_PREFIX}_${key}`;
}
