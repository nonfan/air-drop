# Socket.IO 设备发现迁移文档

## 迁移日期
2026-02-05

## 迁移原因

从 PeerJS 迁移到纯 Socket.IO 设备发现机制，原因如下：

1. **架构简化**：PeerJS 主要用于 P2P 数据传输，但我们的应用已经使用 Socket.IO 和 HTTP 进行文件传输
2. **减少依赖**：移除不必要的 PeerJS 依赖，减小应用体积
3. **统一通信**：使用 Socket.IO 统一处理设备发现和数据传输
4. **更好的控制**：Socket.IO 提供更灵活的事件处理和连接管理
5. **跨网段支持**：通过固定 IP 配置，Socket.IO 可以实现跨网段连接

## 已删除的内容

### 1. 核心服务
- `src/core/services/discovery/PeerDiscoveryService.ts` - PeerJS 设备发现服务
- `src/core/services/transport/PeerJSTransport.ts` - PeerJS 传输层

### 2. 测试文件
- `src/core/__tests__/PeerJSTransport.test.ts` - PeerJS 传输层测试

### 3. 文档
- `docs/PEERJS_INTEGRATION.md` - PeerJS 集成文档
- `docs/PEERJS_USAGE.md` - PeerJS 使用文档
- `docs/PEERJS_DISCOVERY_ONLY.md` - PeerJS 仅发现模式文档
- `docs/TESTING_PEER_DISCOVERY.md` - PeerJS 测试文档
- `docs/LIBP2P_INTEGRATION.md` - libp2p 集成文档

### 4. 配置
- `src/main/config.ts` - 移除 PEER_CONFIG 和 PEER_DISCOVERY 配置
- `src/web/config.ts` - 移除 PEER 配置和 getPeerConfig() 函数
- `package.json` - 移除 peerjs 依赖

### 5. 类型定义
- `src/core/types/device.ts` - 移除 Device 接口中的 peerId 字段

### 6. ServiceManager 修改
- 移除 PeerDiscoveryService 初始化
- 移除 setupPeerDiscoveryEvents() 函数
- 移除 getLocalIP() 函数（不再需要）
- 移除 Services 接口中的 peerDiscovery 字段

## 当前设备发现机制

### 桌面端 (PC to PC)
使用 **UDP 广播** 进行局域网设备发现：
- 服务：`DiscoveryService` (src/core/services/discovery/DiscoveryService.ts)
- 协议：UDP 广播
- 端口：动态分配
- 范围：局域网内

### 移动端 (Mobile to Desktop)
使用 **Socket.IO** 进行设备发现和通信：
- 服务：`WebFileServer` (src/main/services/webServer.ts)
- 协议：Socket.IO over HTTP
- 端口：8888
- 范围：局域网内 + 跨网段（通过固定 IP）

## Socket.IO 设备发现流程

### 1. 桌面端启动
```typescript
// src/main/services/serviceManager.ts
const webServer = new WebFileServer(downloadPath, deviceName);
await webServer.start(8888);
```

### 2. 移动端连接
```typescript
// src/web/hooks/useSocket.ts
const socket = io(serverUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true
});

// 连接成功后发送设备信息
socket.emit('register-device', {
  name: deviceName,
  model: deviceModel,
  type: 'mobile'
});
```

### 3. 设备列表同步
```typescript
// 桌面端接收移动端注册
socket.on('register-device', (deviceInfo) => {
  // 添加到设备列表
  clients.set(socket.id, deviceInfo);
  
  // 广播给所有客户端
  io.emit('device-list-updated', Array.from(clients.values()));
});

// 移动端接收设备列表
socket.on('device-list-updated', (devices) => {
  setDevices(devices);
});
```

## 配置说明

### 桌面端配置
```typescript
// src/main/config.ts
export const APP_CONFIG = {
  PORTS: {
    WEB_SERVER: 8888,        // Socket.IO 服务器端口
    TRANSFER_SERVER: 3001,   // 文件传输服务器端口
    DEV_SERVER: 5173         // Vite 开发服务器端口
  }
};
```

### 移动端配置
```typescript
// src/web/config.ts
export const WEB_CONFIG = {
  FIXED_IP: {
    HOST: '192.168.0.2',  // 桌面端 IP 地址
    PORT: 8888             // Socket.IO 端口
  }
};
```

## 跨网段连接

### 方法 1：固定 IP 配置（推荐）
1. 在移动端设置页面输入桌面端 IP 地址
2. 应用会保存到 localStorage
3. 下次自动使用保存的 IP 连接

### 方法 2：扫码连接
1. 桌面端显示包含 IP 和端口的二维码
2. 移动端扫码获取连接信息
3. 自动连接到桌面端

## 优势对比

| 特性 | PeerJS | Socket.IO |
|------|--------|-----------|
| 设备发现 | 需要公共服务器 | 局域网 UDP + 固定 IP |
| 数据传输 | P2P 直连 | 服务器中转 |
| 跨网段 | 支持（需公共服务器） | 支持（固定 IP） |
| 连接稳定性 | 依赖 NAT 穿透 | 稳定 |
| 配置复杂度 | 高 | 低 |
| 依赖项 | peerjs | socket.io（已有） |

## 性能影响

### 移除 PeerJS 后的改进：
1. **包体积减小**：约 200KB（peerjs 库）
2. **启动速度提升**：减少一个服务初始化
3. **内存占用降低**：减少 PeerJS 连接管理开销
4. **代码复杂度降低**：统一使用 Socket.IO

### 潜在影响：
1. **局域网传输**：无影响，仍使用 HTTP 直连
2. **跨网段传输**：需要手动配置 IP（之前也需要公共服务器）

## 后续优化建议

1. **自动发现优化**
   - 实现 mDNS/Bonjour 服务发现
   - 支持多网段自动扫描

2. **连接管理优化**
   - 实现连接池管理
   - 添加心跳检测机制

3. **性能优化**
   - 实现 WebRTC 数据通道（可选）
   - 优化大文件传输性能

4. **用户体验优化**
   - 简化 IP 配置流程
   - 添加连接历史记录

## 相关文档

- [Electron 框架修复](./ELECTRON_FIXES.md)
- [设备名称初始化](./DEVICE_NAME_INITIALIZATION.md)
- [开发环境设置](./DEV_SETUP.md)

## 测试清单

- [ ] 桌面端启动正常
- [ ] UDP 设备发现正常（PC to PC）
- [ ] Socket.IO 连接正常（Mobile to Desktop）
- [ ] 设备列表同步正常
- [ ] 文件传输功能正常
- [ ] 文本传输功能正常
- [ ] 跨网段连接正常（固定 IP）
- [ ] 扫码连接正常
- [ ] 编译无错误
- [ ] 测试通过
