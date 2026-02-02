import { networkInterfaces } from 'os';

/**
 * 网络工具类
 */
export class NetworkUtils {
  /**
   * 获取本机所有 IPv4 地址
   */
  static getLocalIPs(): Set<string> {
    const ips = new Set<string>(['127.0.0.1', 'localhost']);
    const nets = networkInterfaces();
    
    for (const name of Object.keys(nets)) {
      const interfaces = nets[name];
      if (!interfaces) continue;
      
      for (const net of interfaces) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.add(net.address);
        }
      }
    }
    
    return ips;
  }

  /**
   * 获取首选的局域网 IP 地址
   * 优先级：192.168.x.x > 10.x.x.x > 172.16-31.x.x > 其他
   */
  static getPreferredIP(): string {
    const nets = networkInterfaces();
    const addresses: string[] = [];
    
    for (const name of Object.keys(nets)) {
      const interfaces = nets[name];
      if (!interfaces) continue;
      
      for (const net of interfaces) {
        if (net.family === 'IPv4' && !net.internal) {
          addresses.push(net.address);
        }
      }
    }
    
    // 优先 192.168.x.x
    const preferred = addresses.find(addr => addr.startsWith('192.168.'));
    if (preferred) return preferred;
    
    // 其次 10.x.x.x
    const private10 = addresses.find(addr => addr.startsWith('10.'));
    if (private10) return private10;
    
    // 再次 172.16-31.x.x
    const private172 = addresses.find(addr => {
      const parts = addr.split('.');
      return parts[0] === '172' && 
             parseInt(parts[1]) >= 16 && 
             parseInt(parts[1]) <= 31;
    });
    if (private172) return private172;
    
    // 最后返回第一个可用地址
    return addresses[0] || '127.0.0.1';
  }

  /**
   * 检查 IP 是否为本机地址
   */
  static isLocalIP(ip: string): boolean {
    return this.getLocalIPs().has(ip);
  }

  /**
   * 计算广播地址
   */
  static getBroadcastAddress(ip: string, netmask: string): string {
    const ipParts = ip.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    const broadcast = ipParts.map((part, i) => part | (~maskParts[i] & 255));
    return broadcast.join('.');
  }

  /**
   * 验证 IP 地址格式
   */
  static isValidIP(ip: string): boolean {
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
  static isValidPort(port: number): boolean {
    return Number.isInteger(port) && port > 0 && port <= 65535;
  }
}
