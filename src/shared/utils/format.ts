/**
 * 格式化工具函数
 */

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

// 别名，保持向后兼容
export const formatSize = formatFileSize;

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // 小于 1 分钟
  if (diff < 60 * 1000) {
    return '刚刚';
  }
  
  // 小于 1 小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes} 分钟前`;
  }
  
  // 小于 1 天
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} 小时前`;
  }
  
  // 小于 7 天
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days} 天前`;
  }
  
  // 格式化为日期
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 别名，保持向后兼容
export const formatTime = formatTimestamp;

/**
 * 格式化传输速度
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`;
}

/**
 * 格式化剩余时间
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)} 秒`;
  }
  
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${minutes} 分 ${secs} 秒`;
  }
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours} 小时 ${minutes} 分`;
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number, decimals: number = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * 截断文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}...`;
}

/**
 * 格式化 IP 地址
 */
export function formatIP(ip: string): string {
  // 移除 IPv6 前缀
  return ip.replace('::ffff:', '');
}

/**
 * 格式化设备名称
 */
export function formatDeviceName(name: string, maxLength: number = 20): string {
  return truncateText(name, maxLength);
}
