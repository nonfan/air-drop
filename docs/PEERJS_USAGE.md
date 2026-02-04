# PeerJS 使用指南

## 已完成的集成

### 1. 核心组件

✅ **PeerJSTransport** (`src/core/services/transport/PeerJSTransport.ts`)
- P2P 连接管理
- 文件传输
- 数据通信
- 事件处理

✅ **PeerServer** (`src/main/services/peerServer.ts`)
- 信令服务器
- 运行在端口 9000
- 支持 NAT 穿透（STUN）

✅ **配置文件**
- 主进程配置：`src/main/config.ts`
- Web 端配置：`src/web/config.ts`

✅ **类型定义**
- Device 接口添加了 `peerId` 字段

## 使用方法

### 桌面端使用

```typescript
import { PeerJSTransport } from '@/core/services/transport/PeerJSTransport';
import { APP_CONFIG } from '@/main/config';

// 1. 创建 PeerJS 实例
const peerTransport = new PeerJSTransport(APP_CONFIG.PEER_CONFIG);

// 2. 连接到 PeerServer
await peerTransport.connect();

// 3. 获取自己的 Peer ID
const myPeerId = peerTransport.getPeerId();
console.log('My Peer ID:', myPeerId);

// 4. 连接到其他设备
await peerTransport.connectToPeer('other-peer-id');

// 5. 发送文件
const file = new File(['content'], 'test.txt');
await peerTransport.sendFile('other-peer-id', file, 'transfer-123');

// 6. 监听事件
peerTransport.on('peer-connected', (peerId) => {
  console.log('Connected to:', peerId);
});

peerTransport.on('data', ({ peerId, data }) => {
  console.log('Received data from:', peerId, data);
});

peerTransport.on('send-progress', (progress) => {
  console.log('Progress:', progress.percent + '%');
});
```

### Web 端使用

```typescript
import { PeerJSTransport } from '@/core/services/transport/PeerJSTransport';
import { getPeerConfig } from '@/web/config';

// 1. 创建实例
const peerTransport = new PeerJSTransport(getPeerConfig());

// 2. 连接
await peerTransport.connect();

// 3. 使用（同桌面端）
```

## 下一步集成任务

### Phase 1: 设备发现集成（优先）

需要修改 `DiscoveryService` 来广播和接收 PeerID：

```typescript
// src/core/services/discovery/DiscoveryService.ts

export class DiscoveryService extends EventEmitter {
  private peerTransport: PeerJSTransport;

  async start(): Promise<void> {
    // 1. 启动 PeerJS
    this.peerTransport = new PeerJSTransport(config);
    await this.peerTransport.connect();
    const myPeerId = this.peerTransport.getPeerId();

    // 2. 在设备信息中包含 PeerID
    this.addDevice({
      id: 'my-device',
      name: 'My Device',
      peerId: myPeerId, // 添加这个字段
      // ... 其他字段
    });

    // 3. 启动 mDNS/UDP 发现
    await this.startMDNS();
  }
}
```

### Phase 2: 文件传输集成

创建 `PeerTransferManager` 来处理文件传输：

```typescript
// src/core/services/transfer/PeerTransferManager.ts

export class PeerTransferManager {
  constructor(private peerTransport: PeerJSTransport) {
    this.setupHandlers();
  }

  async sendFile(peerId: string, file: File): Promise<void> {
    const transferId = generateId();
    
    // 1. 发送元数据
    this.peerTransport.send(peerId, {
      type: 'transfer-request',
      transferId,
      fileName: file.name,
      fileSize: file.size
    });

    // 2. 等待接受
    await this.waitForAccept(transferId);

    // 3. 发送文件
    await this.peerTransport.sendFile(peerId, file, transferId);
  }

  private setupHandlers(): void {
    this.peerTransport.on('data', ({ peerId, data }) => {
      if (data.type === 'transfer-request') {
        this.handleTransferRequest(peerId, data);
      }
      // ... 处理其他消息类型
    });
  }
}
```

### Phase 3: UI 集成

在文件传输 UI 中添加 P2P 选项：

```typescript
// src/renderer/components/FileDropZone.tsx

const handleSendFile = async (file: File, device: Device) => {
  if (device.peerId) {
    // 使用 PeerJS 直连（更快）
    await peerTransferManager.sendFile(device.peerId, file);
  } else {
    // 回退到 Socket.IO
    await socketTransferManager.sendFile(device, file);
  }
};
```

## 测试

### 启动应用

```bash
# 1. 构建
npm run build

# 2. 启动（会自动启动 PeerServer）
npm run start
```

### 查看日志

启动后应该看到：

```
[PeerServer] Started on port 9000
[ServiceManager] PeerServer started successfully
```

### 测试连接

打开浏览器控制台：

```javascript
// 测试 PeerServer 是否运行
fetch('http://localhost:9000/peerjs/id')
  .then(r => r.text())
  .then(console.log);
```

## 配置

### 修改端口

编辑 `src/main/config.ts`:

```typescript
PORTS: {
  PEER_SERVER: 9000, // 修改这里
}
```

### 修改 STUN 服务器

编辑 `src/main/services/peerServer.ts`:

```typescript
config: {
  iceServers: [
    { urls: 'stun:your-stun-server.com:3478' }
  ]
}
```

## 故障排除

### PeerServer 启动失败

```
Error: listen EADDRINUSE: address already in use :::9000
```

**解决方案：** 端口 9000 被占用，修改配置文件中的端口号。

### 无法连接到 Peer

**检查：**
1. PeerServer 是否运行
2. 防火墙是否允许端口 9000
3. PeerID 是否正确

### 文件传输失败

**检查：**
1. 两个设备是否都连接到 PeerServer
2. 查看控制台错误日志
3. 检查网络连接

## 性能优化

### 调整分块大小

```typescript
// src/core/services/transport/PeerJSTransport.ts
const chunkSize = 16 * 1024; // 16KB（默认）
// 可以调整为 32KB 或 64KB 以提高速度
```

### 启用压缩

```typescript
// 在发送前压缩数据
import pako from 'pako';

const compressed = pako.deflate(data);
conn.send(compressed);
```

## 下一步

1. ✅ 完成基础集成
2. ⏳ 集成到设备发现
3. ⏳ 实现文件传输管理器
4. ⏳ 添加 UI 支持
5. ⏳ 测试和优化

需要帮助实现下一步吗？
