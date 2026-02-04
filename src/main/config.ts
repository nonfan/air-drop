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
  
  // 端口配置
  PORTS: {
    // Web 服务器端口（Socket.IO）
    WEB_SERVER: 8888,
    
    // 传输服务器起始端口（会自动递增查找可用端口）
    TRANSFER_SERVER: 3001,
    
    // PeerJS 信令服务器端口
    PEER_SERVER: 9000,
    
    // 开发服务器端口（Vite）
    DEV_SERVER: 5173,
    
    // 固定 IP 连接配置（Web 端使用）
    FIXED_IP: {
      HOST: '192.168.0.2',
      PORT: 8888,
    }
  },
  
  // PeerJS 配置
  PEER_CONFIG: {
    host: 'localhost',
    port: 9000,
    path: '/peerjs',
    secure: false
  },
  
  // PeerJS 发现服务配置
  PEER_DISCOVERY: {
    // 使用公共 PeerServer（跨网段发现）
    host: 'peerjs-server.com',
    port: 443,
    secure: true,
    
    // 或使用自建服务器（局域网）
    // host: '192.168.0.2',
    // port: 9000,
    // secure: false,
    
    // 广播间隔（毫秒）
    announceInterval: 10000,
    
    // 设备超时时间（毫秒）
    deviceTimeout: 30000
  }
} as const;

// 生成默认设备名
export function generateDeviceName(): string {
  return `${APP_CONFIG.DEVICE_NAME_PREFIX}-${Math.random().toString(36).slice(2, 6)}`;
}

// 获取 localStorage 键名
export function getStorageKey(key: string): string {
  return `${APP_CONFIG.STORAGE_PREFIX}_${key}`;
}
