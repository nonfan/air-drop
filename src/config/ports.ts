/**
 * 端口配置文件
 * 
 * ⚠️ 重要：修改端口时必须同步更新以下文件：
 * 1. package.json - dev:electron script 中的 wait-on URL
 * 2. vite.config.ts - server.port
 * 3. src/main/window.ts - loadURL 中的端口
 * 4. 本文件 - VITE_DEV_PORT
 */

export const PORTS = {
  /**
   * Vite 开发服务器端口
   * 用于 Electron 渲染进程开发
   */
  VITE_DEV_PORT: 5173,

  /**
   * Web 服务器端口 (Socket.IO)
   * 用于移动端连接
   */
  WEB_SERVER: 8888,

  /**
   * 传输服务器端口
   * 用于桌面端之间的文件传输
   */
  TRANSFER_SERVER: 3001,
} as const;

/**
 * 获取 Vite 开发服务器 URL
 */
export function getViteDevUrl(): string {
  return `http://localhost:${PORTS.VITE_DEV_PORT}`;
}

/**
 * 获取 Web 服务器 URL
 */
export function getWebServerUrl(): string {
  return `http://localhost:${PORTS.WEB_SERVER}`;
}

/**
 * 获取传输服务器 URL
 */
export function getTransferServerUrl(): string {
  return `http://localhost:${PORTS.TRANSFER_SERVER}`;
}
