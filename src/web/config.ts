/**
 * Web 端配置
 * 用于移动端和浏览器端的配置
 */

export const WEB_CONFIG = {
  // 固定 IP 连接配置
  FIXED_IP: {
    HOST: '192.168.0.2',
    PORT: 8888,
  },
  
  // 应用名称
  APP_NAME: 'Airdrop',
  
  // localStorage 键名前缀
  STORAGE_PREFIX: 'airdrop',
} as const;

// 获取 Socket.IO 连接 URL
export function getSocketUrl(): string {
  return `http://${WEB_CONFIG.FIXED_IP.HOST}:${WEB_CONFIG.FIXED_IP.PORT}`;
}

// 获取 localStorage 键名
export function getStorageKey(key: string): string {
  return `${WEB_CONFIG.STORAGE_PREFIX}_${key}`;
}
