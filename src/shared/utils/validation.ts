/**
 * 验证工具函数
 */

/**
 * 验证 IP 地址
 */
export function isValidIP(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255 && part === num.toString();
  });
}

/**
 * 验证端口号
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

/**
 * 验证 URL
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证文件名
 */
export function isValidFileName(fileName: string): boolean {
  // 不允许的字符
  const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
  return !invalidChars.test(fileName) && fileName.length > 0 && fileName.length <= 255;
}

/**
 * 验证文件大小
 */
export function isValidFileSize(size: number, maxSize: number = 10 * 1024 * 1024 * 1024): boolean {
  return size > 0 && size <= maxSize; // 默认最大 10GB
}

/**
 * 验证设备名称
 */
export function isValidDeviceName(name: string): boolean {
  return name.length > 0 && name.length <= 50;
}

/**
 * 验证文本内容
 */
export function isValidText(text: string, maxLength: number = 10000): boolean {
  return text.length > 0 && text.length <= maxLength;
}

/**
 * 清理文件名（移除非法字符）
 */
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
}

/**
 * 清理设备名称
 */
export function sanitizeDeviceName(name: string): string {
  return name.trim().slice(0, 50);
}
