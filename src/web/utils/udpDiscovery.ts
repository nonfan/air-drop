/**
 * UDP 广播发现工具
 * 用于手机端主动探测局域网内的桌面端服务器
 */

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
  private readonly DISCOVERY_TIMEOUT = 5000; // 5秒超时
  private servers = new Map<string, DiscoveredServer>();
  private onServerFound?: (server: DiscoveredServer) => void;
  private onServerLost?: (serverId: string) => void;
  private cleanupInterval: number | null = null;
  private readonly SERVER_TIMEOUT_MS = 15000; // 15秒未响应则认为服务器离线

  /**
   * 开始监听 UDP 广播（浏览器环境下使用 HTTP 轮询模拟）
   */
  start(callbacks: {
    onServerFound?: (server: DiscoveredServer) => void;
    onServerLost?: (serverId: string) => void;
  }) {
    this.onServerFound = callbacks.onServerFound;
    this.onServerLost = callbacks.onServerLost;

    // 浏览器环境无法直接使用 UDP，使用 HTTP 探测
    this.startHttpDiscovery();

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
    this.servers.clear();
  }

  /**
   * 使用 HTTP 探测局域网内的服务器
   * 通过尝试连接常见的 IP 地址和端口
   */
  private async startHttpDiscovery() {
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
    
    // 探测同一子网的常见 IP（优化：只探测部分 IP）
    const ipsToScan: string[] = [];
    
    // 优先探测网关和常见 IP
    ipsToScan.push(`${subnet}.1`);   // 网关
    ipsToScan.push(`${subnet}.100`); // 常见 DHCP 范围
    ipsToScan.push(`${subnet}.101`);
    
    // 探测当前 IP 附近的地址
    const currentLastOctet = parseInt(ipParts[3]);
    for (let i = Math.max(2, currentLastOctet - 10); i <= Math.min(254, currentLastOctet + 10); i++) {
      if (i !== currentLastOctet) {
        ipsToScan.push(`${subnet}.${i}`);
      }
    }

    // 并发探测（限制并发数）
    const concurrency = 10;
    for (let i = 0; i < ipsToScan.length; i += concurrency) {
      const batch = ipsToScan.slice(i, i + concurrency);
      await Promise.all(batch.map(ip => this.probeServer(ip, 8080)));
    }
  }

  /**
   * 探测指定 IP 和端口的服务器
   */
  private async probeServer(ip: string, port: number): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2秒超时

      const response = await fetch(`http://${ip}:${port}/api/info/probe`, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors'
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

        const isNew = !this.servers.has(server.id);
        this.servers.set(server.id, server);

        if (isNew && this.onServerFound) {
          console.log('[UDP Discovery] 发现服务器:', server);
          this.onServerFound(server);
        }
      }
    } catch (error) {
      // 忽略连接失败（正常情况）
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
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch && ipMatch[1]) {
              const ip = ipMatch[1];
              // 过滤掉回环地址
              if (!ip.startsWith('127.')) {
                pc.close();
                resolve(ip);
              }
            }
          }
        };

        // 超时处理
        setTimeout(() => {
          pc.close();
          resolve(null);
        }, 3000);
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
