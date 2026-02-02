# UDP 广播发现功能说明

## 概述

为了解决手机端需要手动输入服务器 IP 地址的问题，我们增加了 UDP 广播辅助发现功能。该功能允许手机端主动探测局域网内的桌面端服务器，实现自动连接。

## 架构设计

### 1. 桌面端（已有）

桌面端已经实现了 UDP 广播功能（`src/main/services/broadcastDiscovery.ts`）：

- 定期在局域网内广播设备信息（每 5 秒）
- 广播端口：3001
- 广播内容：设备 ID、名称、端口、Peer ID

### 2. 手机端（新增）

由于浏览器环境无法直接使用 UDP，我们采用 HTTP 探测方式：

#### 核心组件

**`src/web/utils/udpDiscovery.ts`**
- `UDPDiscovery` 类：负责发现局域网内的服务器
- 通过 WebRTC 获取本地 IP 地址
- 智能扫描同一子网的 IP 地址
- 优先探测网关和常见 IP 范围
- 自动清理离线服务器

**`src/web/hooks/useUDPDiscovery.ts`**
- React Hook 封装
- 自动管理发现生命周期
- 提供服务器列表和发现状态
- 支持手动触发发现

**`src/web/components/ServerSelector.tsx`**
- 服务器选择 UI 组件
- 显示发现的服务器列表
- 支持点击连接

### 3. 服务器端（新增）

**探测接口**
- 路径：`/api/info/probe`
- 方法：GET
- 响应：服务器信息（ID、名称、端口）
- 支持 CORS

## 工作流程

```
┌─────────────┐                    ┌─────────────┐
│   手机端    │                    │   桌面端    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │ 1. 获取本地 IP (WebRTC)          │
       │────────────────────────>         │
       │                                  │
       │ 2. 扫描同一子网                  │
       │    (192.168.1.1-254)             │
       │                                  │
       │ 3. HTTP GET /api/info/probe      │
       │──────────────────────────────────>│
       │                                  │
       │ 4. 返回服务器信息                │
       │<──────────────────────────────────│
       │    { id, name, ip, port }        │
       │                                  │
       │ 5. 显示服务器列表                │
       │                                  │
       │ 6. 用户选择服务器                │
       │                                  │
       │ 7. 保存服务器 URL                │
       │                                  │
       │ 8. 建立 Socket.IO 连接           │
       │<─────────────────────────────────>│
```

## 优化策略

### 1. 智能扫描

- 优先扫描网关 IP（通常是 .1）
- 优先扫描常见 DHCP 范围（.100-.110）
- 扫描当前 IP 附近的地址（±10）
- 限制并发请求数（10 个）

### 2. 超时控制

- 单个探测超时：2 秒
- 服务器离线判定：15 秒无响应
- 定期清理过期服务器

### 3. 用户体验

- 自动在后台发现服务器
- 仅在未连接时启用发现
- 显示发现进度
- 支持手动刷新

## 使用方式

### 桌面端

无需额外配置，UDP 广播和 HTTP 探测接口已自动启用。

### 手机端

1. 打开 Web 应用
2. 如果未连接到服务器，自动开始扫描
3. 发现服务器后显示选择界面
4. 点击服务器即可连接

## 技术细节

### WebRTC 获取本地 IP

```typescript
const pc = new RTCPeerConnection({ iceServers: [] });
pc.createDataChannel('');
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

pc.onicecandidate = (event) => {
  if (event.candidate) {
    const ip = event.candidate.candidate.match(/(\d+\.\d+\.\d+\.\d+)/)[1];
    // 使用 IP 地址
  }
};
```

### HTTP 探测

```typescript
const response = await fetch(`http://${ip}:${port}/api/info/probe`, {
  method: 'GET',
  signal: AbortSignal.timeout(2000),
  mode: 'cors'
});

if (response.ok) {
  const server = await response.json();
  // 发现服务器
}
```

## 限制和注意事项

1. **浏览器限制**
   - 无法直接使用 UDP
   - 依赖 HTTP 探测
   - 需要 CORS 支持

2. **网络限制**
   - 仅支持同一子网
   - 需要防火墙允许 HTTP 访问
   - 某些企业网络可能阻止扫描

3. **性能考虑**
   - 扫描 254 个 IP 需要时间
   - 限制并发数避免过载
   - 优先扫描常见 IP 提高速度

## 未来改进

1. **mDNS/Bonjour 支持**
   - 如果浏览器支持，使用 mDNS 发现
   - 更高效、更可靠

2. **QR 码扫描**
   - 桌面端生成包含 IP 的 QR 码
   - 手机端扫码直接连接

3. **云中继**
   - 通过云服务器中继连接
   - 支持跨网络传输

4. **缓存优化**
   - 记住最近连接的服务器
   - 优先尝试缓存的 IP

## 相关文件

### 新增文件
- `src/web/utils/udpDiscovery.ts` - UDP 发现工具类
- `src/web/hooks/useUDPDiscovery.ts` - UDP 发现 Hook
- `src/web/components/ServerSelector.tsx` - 服务器选择组件

### 修改文件
- `src/main/services/webServer.ts` - 添加探测接口
- `src/web/App.tsx` - 集成 UDP 发现
- `src/web/hooks/index.ts` - 导出新 Hook
- `src/web/utils/index.ts` - 导出新工具
- `src/web/components/index.ts` - 导出新组件

## 测试建议

1. **同一局域网测试**
   - 桌面端和手机端连接同一 WiFi
   - 验证自动发现功能

2. **多设备测试**
   - 多个桌面端同时运行
   - 验证服务器列表显示

3. **网络切换测试**
   - 切换 WiFi 网络
   - 验证重新发现

4. **离线测试**
   - 关闭桌面端
   - 验证服务器自动移除

## 总结

UDP 广播辅助发现功能通过 HTTP 探测实现了手机端自动发现局域网内的桌面端服务器，大大提升了用户体验。虽然受限于浏览器环境无法直接使用 UDP，但通过智能扫描策略和优化，仍然能够快速可靠地发现服务器。
