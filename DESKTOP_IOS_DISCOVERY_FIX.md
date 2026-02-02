# Desktop 端无法发现 iOS 设备问题修复

## 问题描述

iOS 移动端能看到 Desktop 端设备，但 Desktop 端看不到 iOS 设备。

## 根本原因

### 1. 重连检测逻辑问题

后端的重连检测逻辑有缺陷：
- 只要 IP 相同就认为是"重连"
- 即使旧的 Socket 已经断开，仍然被当作重连
- 重连时只触发 `client-updated` 事件，不触发 `client-connected` 事件

### 2. Desktop 端缺少定期刷新

Desktop 端只在初始化时获取一次移动端设备列表，之后完全依赖事件通知。如果事件丢失或时序问题，就会导致设备列表不同步。

### 3. onMobileUpdated 不添加新设备

Desktop 端的 `onMobileUpdated` 事件处理只更新现有设备，不添加新设备。这导致重连时设备无法显示。

## 修复方案

### 1. 修复后端重连检测逻辑

**文件：** `src/main/services/webServer.ts`

```typescript
private handleSocketConnection(socket: Socket) {
  const ip = (socket.handshake.address || '').replace('::ffff:', '');
  
  let clientId = '';
  let clientName = `手机 ${ip.split('.').pop()}`;
  
  // 检查是否是重连（相同 IP 且 Socket 仍然连接）
  for (const [id, existingClient] of this.clients.entries()) {
    if (existingClient.ip === ip && existingClient.socket.connected) {
      clientId = id;
      clientName = existingClient.name;
      console.log(`[WebServer] Client reconnecting: ${clientId} (${ip})`);
      existingClient.socket.disconnect();
      break;
    }
  }
  
  // 清理相同 IP 的断开连接的客户端
  for (const [id, existingClient] of this.clients.entries()) {
    if (existingClient.ip === ip && !existingClient.socket.connected) {
      console.log(`[WebServer] Removing disconnected client with same IP: ${id}`);
      this.clients.delete(id);
    }
  }
  
  if (!clientId) {
    clientId = uuidv4();
    console.log(`[WebServer] New client connecting: ${clientId} (${ip})`);
  }

  // ... 创建客户端 ...

  // 总是触发 client-connected 事件，确保 Desktop 端能收到通知
  this.emit('client-connected', { id: clientId, name: clientName, ip });
  this.broadcastDeviceList();
}
```

**关键改进：**
- ✅ 只有当旧 Socket 仍然连接时才认为是重连
- ✅ 清理相同 IP 的断开连接的客户端
- ✅ 总是触发 `client-connected` 事件
- ✅ 添加详细的日志

### 2. Desktop 端添加定期刷新

**文件：** `src/renderer/App.tsx`

```typescript
// 定期刷新移动端设备列表（每5秒）
const refreshInterval = setInterval(async () => {
  try {
    const mobileClients = await window.windrop.getMobileClients();
    setDevices(prev => {
      // 保留 PC 设备，更新移动端设备
      const pcDevices = prev.filter(d => d.type === 'pc');
      const mobileDevices = mobileClients.map(m => ({ ...m, type: 'mobile' as const }));
      return [...pcDevices, ...mobileDevices];
    });
  } catch (error) {
    console.error('Failed to refresh mobile clients:', error);
  }
}, 5000);

return () => {
  clearInterval(refreshInterval);
};
```

**优势：**
- ✅ 每 5 秒自动刷新设备列表
- ✅ 即使事件丢失也能恢复
- ✅ 确保设备列表始终同步

### 3. 修复 onMobileUpdated 处理

**文件：** `src/renderer/App.tsx`

```typescript
window.windrop.onMobileUpdated((m) => {
  setDevices(prev => {
    const exists = prev.find(x => x.id === m.id);
    if (exists) {
      // 更新现有设备
      return prev.map(x => x.id === m.id ? { ...x, name: m.name, model: m.model } : x);
    } else {
      // 添加新设备（处理重连情况）
      return [...prev, { ...m, type: 'mobile' as const }];
    }
  });
});
```

**改进：**
- ✅ 如果设备不存在，自动添加
- ✅ 处理重连时的设备添加

## 测试步骤

### 1. 启动 Desktop 应用

1. 打开 Electron 应用
2. 查看控制台日志

### 2. iOS 设备连接

1. 在 iOS Safari 中访问 `http://PC_IP:8080`
2. 等待连接成功

### 3. 检查 Desktop 端

应该看到：
- iOS 设备出现在设备列表中
- 设备名称、IP 地址正确显示

### 4. 检查后端日志

应该看到：
```
[WebServer] New client connecting: xxx (192.168.1.100)
[WebServer] getDeviceListForMobile (exclude: xxx): [...]
```

### 5. 测试重连

1. iOS 设备刷新页面或断开连接
2. 重新连接
3. Desktop 端应该能立即看到设备

## 常见问题排查

### 问题 1：Desktop 端仍然看不到 iOS 设备

**检查步骤：**
1. 打开 Electron 开发者工具（View → Toggle Developer Tools）
2. 查看控制台是否有错误
3. 检查是否收到 `mobile-connected` 事件

**手动测试：**
在 Electron 控制台执行：
```javascript
window.windrop.getMobileClients().then(console.log)
```

如果返回空数组，说明后端没有记录 iOS 设备。

### 问题 2：设备列表显示但无法发送

**可能原因：**
- 设备 ID 不匹配
- Socket 连接已断开

**解决方法：**
1. 检查设备 ID 是否正确
2. 在后端日志中查找该设备的连接状态

### 问题 3：定期刷新导致性能问题

**优化方案：**
- 增加刷新间隔（从 5 秒改为 10 秒）
- 只在设备列表为空时刷新
- 使用 WebSocket 心跳检测

## 性能优化建议

### 1. 智能刷新

只在必要时刷新：

```typescript
const refreshInterval = setInterval(async () => {
  // 只在没有移动端设备时刷新
  if (devices.filter(d => d.type === 'mobile').length === 0) {
    const mobileClients = await window.windrop.getMobileClients();
    if (mobileClients.length > 0) {
      setDevices(prev => [...prev.filter(d => d.type === 'pc'), ...mobileClients.map(m => ({ ...m, type: 'mobile' as const }))]);
    }
  }
}, 5000);
```

### 2. 手动刷新按钮

添加一个手动刷新按钮：

```tsx
<button onClick={async () => {
  const mobileClients = await window.windrop.getMobileClients();
  setDevices(prev => [...prev.filter(d => d.type === 'pc'), ...mobileClients.map(m => ({ ...m, type: 'mobile' as const }))]);
}}>
  刷新设备列表
</button>
```

### 3. 连接状态指示

显示设备的连接状态：

```tsx
{device.type === 'mobile' && (
  <span className={device.connected ? 'text-success' : 'text-muted'}>
    {device.connected ? '在线' : '离线'}
  </span>
)}
```

## 修改文件清单

- ✅ `src/main/services/webServer.ts` - 修复重连检测逻辑
- ✅ `src/renderer/App.tsx` - 添加定期刷新和修复 onMobileUpdated
- ✅ `DESKTOP_IOS_DISCOVERY_FIX.md` - 故障排查文档

## 验证清单

- [ ] Desktop 端能看到 iOS 设备
- [ ] iOS 设备重连后 Desktop 端能立即更新
- [ ] 多个 iOS 设备同时连接都能显示
- [ ] 设备名称和 IP 地址正确
- [ ] 后端日志显示正确的连接信息
- [ ] 定期刷新正常工作
- [ ] 没有性能问题或内存泄漏
