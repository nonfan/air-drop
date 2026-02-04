# PeerJS 仅用于设备发现方案

## 架构设计

### 职责分离

```
PeerJS (P2P)          →  设备发现和连接
    ↓
Socket.IO (中心化)    →  文件传输
```

### 为什么这样设计？

#### PeerJS 的优势
- ✅ 跨网段设备发现（通过 DHT）
- ✅ NAT 穿透（STUN/TURN）
- ✅ 全球设备发现
- ✅ 不需要局域网

#### Socket.IO 的优势
- ✅ 稳定可靠
- ✅ 已经实现完整
- ✅ 支持断点续传
- ✅ 进度跟踪完善

## 实施方案

### 1. 使用 PeerJS 发现设备

```typescript
// src/core/services/discovery/PeerDiscoveryService.ts
import Peer from 'peerjs';

export class PeerDiscoveryService {
  private peer: Peer;
  private discoveredPeers: Map<string, PeerInfo> = new Map();

  async start() {
    // 连接到公共 PeerServer（或自建）
    this.peer = new Peer({
      host: 'peerjs-server.com',
      port: 443,
      secure: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    });

    this.peer.on('open', (id) => {
      console.log('[PeerDiscovery] My Peer ID:', id);
      // 广播自己的存在
      this.broadcastPresence(id);
    });

    // 监听其他设备的连接请求
    this.peer.on('connection', (conn) => {
      conn.on('data', (data: any) => {
        if (data.type === 'device-info') {
          // 收到设备信息
          this.addDiscoveredDevice({
            id: conn.peer,
            name: data.name,
            ip: data.ip,
            port: data.port,
            type: data.deviceType
          });
        }
      });
    });
  }

  // 广播自己的设备信息
  private broadcastPresence(peerId: string) {
    // 通过 PeerJS 广播自己的 Socket.IO 服务器地址
    const deviceInfo = {
      type: 'device-info',
      peerId: peerId,
      name: this.deviceName,
      ip: this.getLocalIP(),
      port: 8888, // Socket.IO 端口
      deviceType: 'desktop'
    };

    // 发送给所有已知的 peer
    this.discoveredPeers.forEach((peer, id) => {
      const conn = this.peer.connect(id);
      conn.on('open', () => {
        conn.send(deviceInfo);
      });
    });
  }

  // 添加发现的设备
  private addDiscoveredDevice(device: PeerInfo) {
    this.discoveredPeers.set(device.id, device);
    
    // 触发事件，通知应用层
    this.emit('device-discovered', {
      id: device.id,
      name: device.name,
      // 重要：提供 Socket.IO 连接地址
      socketUrl: `http://${device.ip}:${device.port}`,
      type: device.type
    });
  }
}
```

### 2. 使用 Socket.IO 传输文件

```typescript
// 应用层使用
const peerDiscovery = new PeerDiscoveryService();

peerDiscovery.on('device-discovered', (device) => {
  console.log('发现设备:', device);
  
  // 使用 Socket.IO 连接到设备
  const socket = io(device.socketUrl);
  
  socket.on('connect', () => {
    console.log('已连接到设备:', device.name);
    
    // 使用现有的文件传输逻辑
    sendFileViaSocket(socket, file);
  });
});
```

## 优势分析

### 1. 最小改动
- ✅ 保留现有的文件传输代码
- ✅ 只添加设备发现层
- ✅ 风险最低

### 2. 最佳组合
- ✅ PeerJS 解决发现问题
- ✅ Socket.IO 解决传输问题
- ✅ 各司其职

### 3. 渐进式升级
```
阶段 1: PeerJS 发现 + Socket.IO 传输 ✅
    ↓
阶段 2: 添加 P2P 直连作为可选项
    ↓
阶段 3: 根据网络环境自动选择最佳方式
```

## 实现步骤

### Step 1: 创建 PeerDiscoveryService

```typescript
// src/core/services/discovery/PeerDiscoveryService.ts
export class PeerDiscoveryService extends EventEmitter {
  private peer: Peer | null = null;
  private devices: Map<string, DeviceInfo> = new Map();

  async start(deviceInfo: LocalDeviceInfo) {
    this.peer = new Peer({
      // 配置...
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.peer!.on('connection', (conn) => {
      this.handleIncomingConnection(conn);
    });
  }

  private handleIncomingConnection(conn: DataConnection) {
    conn.on('data', (data: any) => {
      if (data.type === 'device-announce') {
        this.emit('device-found', {
          id: conn.peer,
          name: data.name,
          socketUrl: `http://${data.ip}:${data.port}`
        });
      }
    });
  }

  announceDevice(deviceInfo: LocalDeviceInfo) {
    // 向所有已知设备广播
    this.devices.forEach((device, peerId) => {
      const conn = this.peer!.connect(peerId);
      conn.on('open', () => {
        conn.send({
          type: 'device-announce',
          name: deviceInfo.name,
          ip: deviceInfo.ip,
          port: deviceInfo.port
        });
      });
    });
  }
}
```

### Step 2: 集成到现有系统

```typescript
// src/main/services/serviceManager.ts
export async function initializeServices() {
  // 1. 启动 Socket.IO 服务器（现有）
  const webServer = new WebFileServer(downloadPath, deviceName);
  await webServer.start(8888);

  // 2. 启动 PeerJS 发现服务（新增）
  const peerDiscovery = new PeerDiscoveryService();
  await peerDiscovery.start({
    name: deviceName,
    ip: getLocalIP(),
    port: 8888 // Socket.IO 端口
  });

  // 3. 监听发现的设备
  peerDiscovery.on('device-found', (device) => {
    console.log('[Discovery] Found device:', device);
    // 通知渲染进程
    mainWindow?.webContents.send('device-found', device);
  });

  // 4. 定期广播自己的存在
  setInterval(() => {
    peerDiscovery.announceDevice({
      name: deviceName,
      ip: getLocalIP(),
      port: 8888
    });
  }, 10000); // 每 10 秒广播一次

  return { webServer, peerDiscovery };
}
```

### Step 3: 前端使用

```typescript
// src/renderer/App.tsx
useEffect(() => {
  // 监听通过 PeerJS 发现的设备
  window.windrop.onDeviceFound((device) => {
    setDevices(prev => [...prev, device]);
  });

  // 发送文件时，使用 Socket.IO
  const handleSendFile = async (deviceId: string, file: File) => {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;

    // 使用现有的 Socket.IO 传输
    await window.windrop.sendFiles(deviceId, [file.path]);
  };
}, []);
```

## 网络拓扑

### 局域网内
```
设备 A (PeerJS)  ←→  设备 B (PeerJS)
   ↓ 发现后                ↓
设备 A (Socket.IO) → 设备 B (Socket.IO)
         文件传输
```

### 跨网段
```
设备 A ←→ PeerJS Server ←→ 设备 B
   ↓      (发现和信令)        ↓
设备 A ←→ 中继服务器 ←→ 设备 B
         (文件传输)
```

## 配置示例

```typescript
// src/main/config.ts
export const DISCOVERY_CONFIG = {
  // PeerJS 配置
  PEER: {
    // 使用公共服务器（跨网段发现）
    host: 'peerjs-server.com',
    port: 443,
    secure: true,
    
    // 或使用自建服务器（局域网）
    // host: '192.168.0.2',
    // port: 9000,
    // secure: false
  },

  // Socket.IO 配置（文件传输）
  SOCKET: {
    port: 8888
  },

  // 广播间隔
  ANNOUNCE_INTERVAL: 10000 // 10 秒
};
```

## 优化建议

### 1. 智能发现
```typescript
// 同时使用多种发现方式
class HybridDiscoveryService {
  private mdns: MDNSDiscovery;
  private udp: UDPDiscovery;
  private peer: PeerDiscoveryService;

  async start() {
    // 局域网：mDNS + UDP（快速）
    await this.mdns.start();
    await this.udp.start();
    
    // 跨网段：PeerJS（慢但覆盖广）
    await this.peer.start();
  }
}
```

### 2. 设备去重
```typescript
private deduplicateDevices(devices: Device[]) {
  const seen = new Map<string, Device>();
  
  devices.forEach(device => {
    // 使用 MAC 地址或设备 ID 去重
    const key = device.macAddress || device.id;
    if (!seen.has(key)) {
      seen.set(key, device);
    }
  });
  
  return Array.from(seen.values());
}
```

### 3. 连接质量检测
```typescript
async function selectBestConnection(device: Device) {
  // 1. 尝试局域网直连（最快）
  if (await testConnection(device.localIP)) {
    return { type: 'local', url: `http://${device.localIP}:8888` };
  }
  
  // 2. 尝试公网 IP
  if (device.publicIP && await testConnection(device.publicIP)) {
    return { type: 'public', url: `http://${device.publicIP}:8888` };
  }
  
  // 3. 使用中继服务器
  return { type: 'relay', url: 'http://relay-server.com' };
}
```

## 总结

### 这个方案的核心思想

**PeerJS 只做一件事：告诉你"谁在线"和"怎么连接他"**

1. PeerJS 发现设备
2. 获取设备的 Socket.IO 地址
3. 使用 Socket.IO 传输文件

### 优势
- ✅ 改动最小
- ✅ 风险最低
- ✅ 保留现有功能
- ✅ 扩展跨网段能力

### 未来扩展
当需要时，可以轻松添加 P2P 直连：
```typescript
if (device.supportsPeerTransfer) {
  // 使用 PeerJS DataChannel 直连
  await sendFileViaPeer(device.peerId, file);
} else {
  // 回退到 Socket.IO
  await sendFileViaSocket(device.socketUrl, file);
}
```

这样既保证了稳定性，又为未来的 P2P 传输留下了空间！
