# libp2p 集成方案

## 概述

libp2p 是 IPFS 使用的工业级 P2P 网络库，提供了强大的设备发现和连接能力。

## 当前架构 vs libp2p

### 当前实现
```
设备发现：mDNS (Bonjour) + UDP 广播
传输协议：Socket.IO (WebSocket + HTTP)
NAT 穿透：无
连接方式：中心化服务器中转
```

### libp2p 优势
```
设备发现：mDNS + WebRTC + DHT + Bootstrap
传输协议：多种传输层（WebSocket, WebRTC, TCP, QUIC）
NAT 穿透：内置 STUN/TURN + Hole Punching
连接方式：真正的 P2P 直连
```

## 集成方案

### 方案 A：完全替换（推荐用于新项目）

**优点：**
- 获得 libp2p 的所有能力
- 真正的 P2P 架构
- 自动 NAT 穿透
- 支持多种网络环境

**缺点：**
- 需要重写大量代码
- 学习曲线陡峭
- 包体积增加（~2MB）
- 移动端兼容性需要测试

**实施步骤：**
```bash
# 1. 安装依赖
npm install libp2p @libp2p/tcp @libp2p/websockets @libp2p/webrtc
npm install @libp2p/mdns @libp2p/bootstrap @libp2p/kad-dht
npm install @libp2p/noise @libp2p/yamux @libp2p/mplex

# 2. 创建 libp2p 节点
# 3. 实现设备发现
# 4. 实现文件传输
# 5. 迁移现有功能
```

### 方案 B：混合架构（推荐用于现有项目）

**优点：**
- 渐进式迁移
- 保留现有功能
- 降低风险
- 可以 A/B 测试

**缺点：**
- 维护两套系统
- 代码复杂度增加

**架构设计：**
```typescript
// 统一的传输层抽象
interface ITransport {
  connect(peer: string): Promise<void>;
  send(data: Buffer): Promise<void>;
  disconnect(): void;
}

// Socket.IO 实现（现有）
class SocketIOTransport implements ITransport { }

// libp2p 实现（新增）
class Libp2pTransport implements ITransport { }

// 自动选择最佳传输方式
class AdaptiveTransport {
  async selectBestTransport(): Promise<ITransport> {
    // 1. 尝试 libp2p 直连
    // 2. 回退到 Socket.IO
  }
}
```

### 方案 C：仅用于设备发现（最小改动）

**优点：**
- 改动最小
- 提升发现能力
- 保留现有传输层

**缺点：**
- 无法利用 P2P 直连
- 仍需中心服务器

**实施：**
```typescript
// 只使用 libp2p 的发现功能
import { createLibp2p } from 'libp2p';
import { mdns } from '@libp2p/mdns';
import { bootstrap } from '@libp2p/bootstrap';

class Libp2pDiscovery {
  private node: Libp2p;

  async start() {
    this.node = await createLibp2p({
      peerDiscovery: [
        mdns(),
        bootstrap({
          list: ['your-bootstrap-nodes']
        })
      ]
    });

    this.node.addEventListener('peer:discovery', (evt) => {
      // 发现设备后，仍使用 Socket.IO 连接
      this.connectViaSocketIO(evt.detail);
    });
  }
}
```

## 技术对比

### 包体积
```
当前方案：
- socket.io-client: ~200KB
- bonjour-service: ~50KB
总计：~250KB

libp2p 方案：
- libp2p 核心: ~500KB
- 传输层: ~300KB
- 发现层: ~200KB
- 加密层: ~500KB
总计：~1.5MB
```

### 性能对比
```
设备发现速度：
- 当前 mDNS: 1-3 秒
- libp2p mDNS: 1-3 秒
- libp2p DHT: 5-10 秒（但能发现更多设备）

连接建立：
- Socket.IO: 100-500ms
- libp2p WebSocket: 100-500ms
- libp2p WebRTC: 1-3 秒（但是直连）

传输速度：
- Socket.IO: 受服务器带宽限制
- libp2p P2P: 仅受本地网络限制（更快）
```

### 网络环境支持
```
局域网：
- 当前方案: ✅ 优秀
- libp2p: ✅ 优秀

跨网段：
- 当前方案: ❌ 不支持
- libp2p: ✅ 支持（通过 DHT）

NAT 穿透：
- 当前方案: ❌ 不支持
- libp2p: ✅ 支持（WebRTC + STUN/TURN）

移动网络：
- 当前方案: ⚠️ 需要服务器
- libp2p: ✅ 自动处理
```

## 推荐方案

### 对于当前项目：方案 B（混合架构）

**理由：**
1. 项目已经有稳定的 Socket.IO 实现
2. 用户主要在局域网使用（当前方案已够用）
3. 渐进式迁移风险更低
4. 可以先在桌面端测试 libp2p

**实施路线图：**

#### Phase 1: 准备工作（1-2 天）
- [ ] 创建传输层抽象接口
- [ ] 重构现有代码使用抽象接口
- [ ] 添加传输方式选择逻辑

#### Phase 2: libp2p 集成（3-5 天）
- [ ] 安装 libp2p 依赖
- [ ] 实现 Libp2pTransport
- [ ] 实现设备发现
- [ ] 实现文件传输

#### Phase 3: 测试和优化（2-3 天）
- [ ] 单元测试
- [ ] 集成测试
- [ ] 性能测试
- [ ] 跨网段测试

#### Phase 4: 灰度发布（1 周）
- [ ] 添加功能开关
- [ ] 桌面端先启用
- [ ] 收集反馈
- [ ] 移动端启用

## 代码示例

### 1. 传输层抽象

```typescript
// src/core/services/transport/ITransport.ts
export interface ITransport extends EventEmitter {
  connect(config: TransportConfig): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  send(event: string, data?: any): void;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler?: (...args: any[]) => void): void;
}

export interface TransportConfig {
  peerId?: string;
  url?: string;
  [key: string]: any;
}
```

### 2. libp2p 实现

```typescript
// src/core/services/transport/Libp2pTransport.ts
import { createLibp2p, Libp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@libp2p/noise';
import { yamux } from '@libp2p/yamux';
import { mdns } from '@libp2p/mdns';
import { ITransport, TransportConfig } from './ITransport';

export class Libp2pTransport extends EventEmitter implements ITransport {
  private node: Libp2p | null = null;
  private connections: Map<string, Connection> = new Map();

  async connect(config: TransportConfig): Promise<void> {
    this.node = await createLibp2p({
      addresses: {
        listen: ['/ip4/0.0.0.0/tcp/0', '/ip4/0.0.0.0/tcp/0/ws']
      },
      transports: [tcp(), webSockets()],
      connectionEncryption: [noise()],
      streamMuxers: [yamux()],
      peerDiscovery: [mdns()],
      connectionManager: {
        autoDial: true
      }
    });

    await this.node.start();
    this.setupEventHandlers();
    this.emit('connected');
  }

  disconnect(): void {
    if (this.node) {
      this.node.stop();
      this.node = null;
      this.emit('disconnected');
    }
  }

  isConnected(): boolean {
    return this.node !== null;
  }

  async send(event: string, data?: any): Promise<void> {
    if (!this.node) {
      throw new Error('Not connected');
    }

    // 实现自定义协议发送数据
    const protocol = '/airdrop/1.0.0';
    const message = JSON.stringify({ event, data });
    
    // 发送到所有连接的节点
    for (const [peerId, conn] of this.connections) {
      const stream = await conn.newStream(protocol);
      await stream.sink([new TextEncoder().encode(message)]);
    }
  }

  on(event: string, handler: (...args: any[]) => void): void {
    super.on(event, handler);
  }

  off(event: string, handler?: (...args: any[]) => void): void {
    super.off(event, handler);
  }

  private setupEventHandlers(): void {
    if (!this.node) return;

    // 监听新连接
    this.node.addEventListener('peer:connect', (evt) => {
      const peerId = evt.detail.toString();
      console.log('Connected to peer:', peerId);
      this.emit('peer-connected', peerId);
    });

    // 监听断开连接
    this.node.addEventListener('peer:disconnect', (evt) => {
      const peerId = evt.detail.toString();
      console.log('Disconnected from peer:', peerId);
      this.connections.delete(peerId);
      this.emit('peer-disconnected', peerId);
    });

    // 监听发现新节点
    this.node.addEventListener('peer:discovery', (evt) => {
      const peerId = evt.detail.id.toString();
      console.log('Discovered peer:', peerId);
      this.emit('peer-discovered', peerId);
    });

    // 注册自定义协议处理器
    this.node.handle('/airdrop/1.0.0', async ({ stream }) => {
      // 处理接收到的消息
      for await (const chunk of stream.source) {
        const message = new TextDecoder().decode(chunk.subarray());
        const { event, data } = JSON.parse(message);
        this.emit(event, data);
      }
    });
  }
}
```

### 3. 自适应传输层

```typescript
// src/core/services/transport/AdaptiveTransport.ts
import { ITransport, TransportConfig } from './ITransport';
import { UnifiedTransportService } from './UnifiedTransport';
import { Libp2pTransport } from './Libp2pTransport';

export class AdaptiveTransport extends EventEmitter implements ITransport {
  private transport: ITransport | null = null;
  private preferLibp2p: boolean;

  constructor(preferLibp2p = false) {
    super();
    this.preferLibp2p = preferLibp2p;
  }

  async connect(config: TransportConfig): Promise<void> {
    // 尝试 libp2p（如果启用）
    if (this.preferLibp2p) {
      try {
        console.log('[Transport] Trying libp2p...');
        this.transport = new Libp2pTransport();
        await this.transport.connect(config);
        console.log('[Transport] Using libp2p');
        this.forwardEvents();
        return;
      } catch (error) {
        console.warn('[Transport] libp2p failed:', error);
      }
    }

    // 回退到 Socket.IO
    console.log('[Transport] Using Socket.IO');
    this.transport = new UnifiedTransportService({
      url: config.url || 'http://localhost:8888'
    });
    await this.transport.connect(config);
    this.forwardEvents();
  }

  disconnect(): void {
    this.transport?.disconnect();
  }

  isConnected(): boolean {
    return this.transport?.isConnected() ?? false;
  }

  send(event: string, data?: any): void {
    this.transport?.send(event, data);
  }

  on(event: string, handler: (...args: any[]) => void): void {
    super.on(event, handler);
  }

  off(event: string, handler?: (...args: any[]) => void): void {
    super.off(event, handler);
  }

  private forwardEvents(): void {
    if (!this.transport) return;

    // 转发所有事件
    const events = ['connected', 'disconnected', 'error', 'peer-connected', 'peer-disconnected'];
    events.forEach(event => {
      this.transport!.on(event, (...args) => {
        this.emit(event, ...args);
      });
    });
  }
}
```

### 4. 使用示例

```typescript
// src/desktop/adapters/ServiceAdapter.ts
import { AdaptiveTransport } from '@/core/services/transport/AdaptiveTransport';

export class ServiceAdapter {
  private transport: AdaptiveTransport;

  constructor() {
    // 从设置中读取是否启用 libp2p
    const useLibp2p = localStorage.getItem('use_libp2p') === 'true';
    this.transport = new AdaptiveTransport(useLibp2p);
  }

  async connect() {
    await this.transport.connect({
      url: 'http://192.168.0.2:8888'
    });
  }
}
```

## 配置选项

```typescript
// src/main/config.ts
export const TRANSPORT_CONFIG = {
  // 是否启用 libp2p
  ENABLE_LIBP2P: process.env.ENABLE_LIBP2P === 'true',
  
  // libp2p 配置
  LIBP2P: {
    // Bootstrap 节点（用于跨网段发现）
    BOOTSTRAP_NODES: [
      '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ'
    ],
    
    // 是否启用 DHT
    ENABLE_DHT: true,
    
    // 是否启用 WebRTC
    ENABLE_WEBRTC: true,
    
    // STUN 服务器
    STUN_SERVERS: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302'
    ]
  }
};
```

## 性能优化建议

### 1. 懒加载 libp2p
```typescript
// 只在需要时加载 libp2p
async function loadLibp2p() {
  const { createLibp2p } = await import('libp2p');
  return createLibp2p;
}
```

### 2. 连接池管理
```typescript
class ConnectionPool {
  private maxConnections = 10;
  private connections: Map<string, Connection> = new Map();

  async getConnection(peerId: string): Promise<Connection> {
    // 复用现有连接
    if (this.connections.has(peerId)) {
      return this.connections.get(peerId)!;
    }

    // 检查连接数限制
    if (this.connections.size >= this.maxConnections) {
      this.evictOldestConnection();
    }

    // 创建新连接
    const conn = await this.createConnection(peerId);
    this.connections.set(peerId, conn);
    return conn;
  }
}
```

### 3. 数据压缩
```typescript
import { compress, decompress } from 'lz4';

async function sendCompressed(data: Buffer): Promise<void> {
  const compressed = await compress(data);
  await stream.sink([compressed]);
}
```

## 测试计划

### 单元测试
```typescript
describe('Libp2pTransport', () => {
  it('should connect to peer', async () => {
    const transport = new Libp2pTransport();
    await transport.connect({});
    expect(transport.isConnected()).toBe(true);
  });

  it('should discover peers', async () => {
    const transport = new Libp2pTransport();
    const peers: string[] = [];
    
    transport.on('peer-discovered', (peerId) => {
      peers.push(peerId);
    });

    await transport.connect({});
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    expect(peers.length).toBeGreaterThan(0);
  });
});
```

### 集成测试
```bash
# 启动两个实例测试 P2P 连接
npm run test:integration
```

## 总结

### 短期建议（1-2 周）
保持当前 Socket.IO 方案，专注于：
1. 优化现有的 mDNS 和 UDP 发现
2. 提升传输稳定性
3. 完善错误处理

### 中期建议（1-2 月）
实施混合架构：
1. 创建传输层抽象
2. 集成 libp2p 作为可选项
3. 在桌面端测试
4. 收集用户反馈

### 长期建议（3-6 月）
如果 libp2p 表现良好：
1. 逐步迁移到 libp2p
2. 移除 Socket.IO 依赖
3. 实现完整的 P2P 架构
4. 支持跨网段传输

## 参考资源

- [libp2p 官方文档](https://docs.libp2p.io/)
- [libp2p 示例](https://github.com/libp2p/js-libp2p-examples)
- [IPFS 架构](https://docs.ipfs.tech/concepts/how-ipfs-works/)
- [WebRTC vs WebSocket](https://bloggeek.me/webrtc-vs-websockets/)
