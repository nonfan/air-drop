/**
 * UDP 广播发现工具
 * 用于手机端主动探测局域网内的桌面端服务器
 */
import { WEB_CONFIG } from '../config';

export interface DiscoveredServer {
  id: string;
  name: string;
  ip: string;
  port: number;
  peerId?: string;
  timestamp: number;
}

export class UDPDiscovery {
  private readonly BROADCAST_PORT = 3001;
  private readonly DISCOVERY_TIMEOUT = 2000; // 2秒超时（加快速度）
  private readonly PROBE_TIMEOUT = 1000; // 1秒探测超时（加快速度）
  private readonly SCAN_INTERVAL = 10000; // 10秒自动重新扫描
  private servers = new Map<string, DiscoveredServer>();
  private onServerFound?: (server: DiscoveredServer) => void;
  private onServerLost?: (serverId: string) => void;
  private cleanupInterval: number | null = null;
  private scanInterval: number | null = null;
  private readonly SERVER_TIMEOUT_MS = 30000; // 30秒未响应则认为服务器离线
  private isScanning = false;

  /**
   * 开始监听 UDP 广播（浏览器环境下使用 HTTP 轮询模拟）
   */
  start(callbacks: {
    onServerFound?: (server: DiscoveredServer) => void;
    onServerLost?: (serverId: string) => void;
  }) {
    this.onServerFound = callbacks.onServerFound;
    this.onServerLost = callbacks.onServerLost;

    // 立即执行一次扫描
    this.startHttpDiscovery();

    // 定期自动扫描（每10秒）
    this.scanInterval = window.setInterval(() => {
      if (!this.isScanning) {
        this.startHttpDiscovery();
      }
    }, this.SCAN_INTERVAL);

    // 定期清理过期服务器
    this.cleanupInterval = window.setInterval(() => {
      this.cleanupStaleServers();
    }, 5000);
  }

  /**
   * 停止发现
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.servers.clear();
    this.isScanning = false;
  }

  /**
   * 使用 HTTP 探测局域网内的服务器
   * 通过尝试连接常见的 IP 地址和端口
   */
  private async startHttpDiscovery() {
    if (this.isScanning) {
      console.log('[UDP Discovery] 扫描进行中，跳过');
      return;
    }

    this.isScanning = true;
    console.log('[UDP Discovery] 开始扫描...');

    try {
      // 获取当前设备的 IP 地址（通过 WebRTC）
      const localIP = await this.getLocalIP();
      if (!localIP) {
        console.warn('[UDP Discovery] 无法获取本地 IP 地址');
        return;
      }

      console.log('[UDP Discovery] 本地 IP:', localIP);

      // 解析 IP 段
      const ipParts = localIP.split('.');
      if (ipParts.length !== 4) return;

      const subnet = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
      
      // 探测同一子网的常见 IP（优化：智能扫描）
      const ipsToScan: string[] = [];
      
      // 第一优先级：网关和常见服务器 IP
      const priorityIPs = [
        `${subnet}.1`,   // 网关
        `${subnet}.2`,   // 备用网关
        `${subnet}.100`, // 常见 DHCP 范围
        `${subnet}.101`,
        `${subnet}.102`,
        `${subnet}.10`,  // 常见静态 IP
        `${subnet}.20`,
        `${subnet}.50`
      ];
      
      // 第二优先级：当前 IP 附近（±5）
      const currentLastOctet = parseInt(ipParts[3]);
      for (let i = Math.max(2, currentLastOctet - 5); i <= Math.min(254, currentLastOctet + 5); i++) {
        if (i !== currentLastOctet) {
          const ip = `${subnet}.${i}`;
          if (!priorityIPs.includes(ip)) {
            ipsToScan.push(ip);
          }
        }
      }
      
      // 合并优先级 IP 到前面
      const allIPs = [...priorityIPs, ...ipsToScan];

      // 并发探测（增加并发数以加快速度）
      const concurrency = 20;
      for (let i = 0; i < allIPs.length; i += concurrency) {
        const batch = allIPs.slice(i, i + concurrency);
        await Promise.all(batch.map(ip => this.probeServer(ip, WEB_CONFIG.FIXED_IP.PORT)));
        
        // 如果已经找到服务器，可以提前结束（可选）
        if (this.servers.size > 0 && i === 0) {
          console.log('[UDP Discovery] 已找到服务器，继续扫描以发现更多...');
        }
      }

      console.log('[UDP Discovery] 扫描完成，发现', this.servers.size, '个服务器');
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * 探测指定 IP 和端口的服务器
   */
  private async probeServer(ip: string, port: number): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.PROBE_TIMEOUT);

      const response = await fetch(`http://${ip}:${port}/api/info/probe`, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-cache' // 禁用缓存，确保每次都是新请求
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        const server: DiscoveredServer = {
          id: data.id || `${ip}:${port}`,
          name: data.deviceName || '未知设备',
          ip,
          port,
          peerId: data.peerId,
          timestamp: Date.now()
        };

        const existingServer = this.servers.get(server.id);
        const isNew = !existingServer;
        
        // 更新服务器时间戳
        this.servers.set(server.id, server);

        if (isNew && this.onServerFound) {
          console.log('[UDP Discovery] 发现新服务器:', server);
          this.onServerFound(server);
        } else if (existingServer) {
          // 更新现有服务器的时间戳（保持在线状态）
          console.log('[UDP Discovery] 更新服务器时间戳:', server.name);
        }
      }
    } catch (error) {
      // 忽略连接失败（正常情况）
      // 只在开发模式下输出详细错误
      if (process.env.NODE_ENV === 'development') {
        // console.debug(`[UDP Discovery] 探测失败: ${ip}:${port}`);
      }
    }
  }

  /**
   * 清理过期的服务器
   */
  private cleanupStaleServers() {
    const now = Date.now();
    
    for (const [id, server] of this.servers.entries()) {
      if (now - server.timestamp > this.SERVER_TIMEOUT_MS) {
        console.log('[UDP Discovery] 服务器离线:', server.name);
        this.servers.delete(id);
        if (this.onServerLost) {
          this.onServerLost(id);
        }
      }
    }
  }

  /**
   * 获取本地 IP 地址（通过 WebRTC）
   */
  private async getLocalIP(): Promise<string | null> {
    try {
      const pc = new RTCPeerConnection({
        iceServers: []
      });

      pc.createDataChannel('');
      
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      return new Promise((resolve) => {
        let resolved = false;
        
        pc.onicecandidate = (event) => {
          if (event.candidate && !resolved) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch && ipMatch[1]) {
              const ip = ipMatch[1];
              // 过滤掉回环地址
              if (!ip.startsWith('127.')) {
                resolved = true;
                pc.close();
                resolve(ip);
              }
            }
          }
        };

        // 超时处理（缩短到1秒）
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            pc.close();
            resolve(null);
          }
        }, 1000);
      });
    } catch (error) {
      console.error('[UDP Discovery] 获取本地 IP 失败:', error);
      return null;
    }
  }

  /**
   * 获取已发现的服务器列表
   */
  getServers(): DiscoveredServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * 手动触发一次发现
   */
  async discover(): Promise<DiscoveredServer[]> {
    await this.startHttpDiscovery();
    return this.getServers();
  }
}
