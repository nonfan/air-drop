# 混合设备发现策略文档

## 概述

应用使用**双层发现策略**，结合各种方式的优势：

1. **UDP 广播** - 局域网内桌面端发现（最快）
2. **Socket.IO** - 移动端连接（快速稳定）

> **注意**: 之前计划的 PeerJS（Layer 3）已移除，因为 PeerJS 需要 WebRTC，在 Electron 主进程（Node.js 环境）中不可用。

## 双层发现架构

```
┌─────────────────────────────────────────────────────┐
│                   设备发现层                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Layer 1: UDP 广播 (局域网内，桌面端)               │
│  ├─ 速度: <100ms                                    │
│  ├─ 范围: 同一局域网                                │
│  └─ 用途: 桌面端之间快速发现                        │
│                                                     │
│  Layer 2: Socket.IO (移动端连接)                    │
│  ├─ 速度: 100-500ms                                 │
│  ├─ 范围: 局域网 + 跨网段(固定IP)                   │
│  └─ 用途: 移动端与桌面端通信                        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## 为什么移除 PeerJS？

### 技术限制

PeerJS 依赖 WebRTC API，这些 API 仅在浏览器环境中可用：
- ❌ Electron 主进程（Node.js）不支持 WebRTC
- ❌ 报错: "The current browser does not support WebRTC"
- ❌ 无法在桌面端使用

### 替代方案

对于跨网段连接，推荐使用：
1. **固定 IP 配置** - 在移动端配置桌面端的 IP 地址
2. **端口转发** - 使用路由器端口转发功能
3. **VPN** - 使用 VPN 将设备连接到同一虚拟局域网

## 各层详细说明

### Layer 1: UDP 广播

**实现**: `DiscoveryService`

**特点**:
- ✅ 最快（<100ms）
- ✅ 无需配置
- ✅ 自动发现
- ❌ 仅限局域网
- ❌ 仅桌面端

**使用场景**:
- 同一局域网内的桌面端之间
- 办公室、家庭网络
- 需要最快速度的场景

**代码示例**:
```typescript
// src/desktop/adapters/ServiceAdapter.ts
const discoveryService = new DiscoveryService();
await discoveryService.start(deviceName, port);
```

### Layer 2: Socket.IO

**实现**: `WebFileServer`

**特点**:
- ✅ 快速（100-500ms）
- ✅ 稳定可靠
- ✅ 实时双向通信
- ✅ 支持跨网段（固定IP）
- ⚠️ 需要知道服务器IP（跨网段时）

**使用场景**:
- 移动端连接桌面端
- 跨网段连接（配置IP）
- 需要稳定连接的场景

**代码示例**:
```typescript
// src/main/services/webServer.ts
const webServer = new WebFileServer(downloadPath, deviceName);
await webServer.start(8888);
```

## 发现流程

### 桌面端启动流程

```
1. 启动 UDP 广播服务
   ├─ 立即开始广播
   └─ 监听其他桌面端

2. 启动 Socket.IO 服务器
   ├─ 监听端口 8888
   └─ 等待移动端连接
```

### 设备发现优先级

```
发现设备时的优先级：

1. UDP 广播 (最高优先级)
   └─ 如果在局域网内，立即发现

2. Socket.IO
   └─ 如果是移动端，通过 Socket.IO 连接
```

## 性能对比

| 发现方式 | 速度 | 稳定性 | 范围 | 配置 |
|---------|------|--------|------|------|
| UDP 广播 | ⚡⚡⚡ <100ms | ⭐⭐⭐⭐⭐ 99% | 局域网 | 无需 |
| Socket.IO | ⚡⚡ 100-500ms | ⭐⭐⭐⭐⭐ 99% | 局域网+跨网段 | 跨网段需IP |

## 跨网段连接方案

### 方案 1: 固定 IP 配置（推荐）

在移动端手动输入桌面端的 IP 地址：

```typescript
// 移动端配置
const serverIP = '192.168.1.100'; // 桌面端 IP
const socket = io(`http://${serverIP}:8888`);
```

**优点**:
- ✅ 稳定可靠
- ✅ 速度快（100-500ms）
- ✅ 无需额外服务

**缺点**:
- ❌ 需要手动配置
- ❌ IP 变化需要重新配置

### 方案 2: 端口转发

在路由器上配置端口转发：

```
外网端口 8888 → 内网 192.168.1.100:8888
```

**优点**:
- ✅ 可以从外网访问
- ✅ 使用公网 IP 或域名

**缺点**:
- ❌ 需要路由器配置权限
- ❌ 有安全风险

### 方案 3: VPN

使用 VPN 将设备连接到同一虚拟局域网：

**优点**:
- ✅ 安全
- ✅ 自动发现（UDP 可用）
- ✅ 无需配置 IP

**缺点**:
- ❌ 需要 VPN 服务
- ❌ 可能影响速度

## 配置说明

### Socket.IO 服务器配置

```typescript
// src/main/services/serviceManager.ts
const webServer = new WebFileServer(downloadPath, deviceName);
await webServer.start(APP_CONFIG.PORTS.WEB_SERVER); // 默认 8888
```

### 移动端连接配置

```typescript
// src/web/hooks/useSocket.ts
const socket = io(serverURL, {
  reconnectionDelay: 500,
  reconnectionAttempts: 10,
  timeout: 10000
});
```

## 使用场景示例

### 场景 1: 同一局域网（办公室/家庭）

```
设备A (桌面端) ←─ UDP 广播 ─→ 设备B (桌面端)
     ↓
Socket.IO 服务器
     ↓
设备C (移动端)

发现速度：
- 桌面端之间: <100ms (UDP)
- 移动端: 100-500ms (Socket.IO)
```

### 场景 2: 跨网段（家里 + 办公室）

```
设备A (家里) ─→ 配置 IP ─→ 设备B (办公室)
              Socket.IO

发现速度：100-500ms
前提：需要知道对方 IP 地址
```

## 优势总结

### 为什么使用双层策略？

1. **最佳性能**: UDP 提供最快的局域网发现（<100ms）
2. **最佳稳定性**: Socket.IO 提供最稳定的移动端连接（99%）
3. **简单可靠**: 无复杂依赖，易于维护
4. **容错性**: 一种方式失败，另一种仍可用

### 与单一方案对比

| 方案 | 局域网速度 | 跨网段 | 稳定性 | 配置复杂度 |
|------|-----------|--------|--------|-----------|
| 仅 UDP | ⚡⚡⚡ | ❌ | ⭐⭐⭐⭐⭐ | 简单 |
| 仅 Socket.IO | ⚡⚡ | ⚠️ 需配置 | ⭐⭐⭐⭐⭐ | 中等 |
| **双层方案** | **⚡⚡⚡** | **⚠️ 需配置** | **⭐⭐⭐⭐⭐** | **简单** |

## 故障处理

### UDP 发现失败

**症状**: 局域网内看不到其他桌面端

**原因**:
- 防火墙阻止 UDP 广播
- 不在同一子网
- 路由器禁用广播

**解决**:
- 检查防火墙设置
- 确认在同一局域网
- 使用 Socket.IO（配置 IP）

### Socket.IO 连接失败

**症状**: 移动端无法连接桌面端

**原因**:
- IP 地址错误
- 端口被占用
- 防火墙阻止

**解决**:
- 确认桌面端 IP 地址
- 检查端口 8888 是否可用
- 检查防火墙设置

### 设备发现慢

**症状**: 设备列表更新慢

**检查**:
1. UDP 是否正常？（局域网内应 <100ms）
2. Socket.IO 是否连接？（移动端）
3. 网络延迟是否过高？

**优化**:
- 确保在同一局域网（使用 UDP）
- 配置固定 IP（使用 Socket.IO）
- 检查网络质量

## 监控和调试

### 查看发现状态

```typescript
// 检查 UDP 状态
console.log('UDP Discovery:', discoveryService.isRunning());

// 检查 Socket.IO 状态
console.log('Socket.IO Clients:', webServer.getClients());
```

### 日志输出

```
[ServiceManager] Initializing services...
[ServiceAdapter] All services initialized successfully
[ServiceManager] Web server running at: http://192.168.0.2:8888
[ServiceManager] Using UDP + Socket.IO for device discovery
[ServiceManager] All services initialized successfully
```

## 最佳实践

1. **局域网优先**: 尽量在同一局域网使用（最快）
2. **配置固定IP**: 移动端配置桌面端IP（稳定）
3. **监控日志**: 关注各层发现状态
4. **容错设计**: 不依赖单一发现方式
5. **安全考虑**: 跨网段连接时注意网络安全

## 相关文档

- [Socket.IO vs PeerJS 性能对比](./SOCKETIO_VS_PEERJS_PERFORMANCE.md)
- [Socket.IO 迁移指南](./SOCKETIO_MIGRATION.md)
- [性能优化文档](./PERFORMANCE_OPTIMIZATION.md)

## 总结

双层发现策略结合了两种方式的优势：
- **UDP**: 局域网内最快（<100ms）
- **Socket.IO**: 移动端最稳定（100-500ms）

这种策略提供了最佳的性能和稳定性，同时保持了简单可靠的架构。对于跨网段连接，推荐使用固定 IP 配置或 VPN 方案。
