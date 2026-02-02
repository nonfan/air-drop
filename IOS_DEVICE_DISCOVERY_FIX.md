# iOS 移动端设备发现问题修复

## 问题描述

iOS 移动端访问 Web 界面后，无法看到 PC 端设备（设备列表为空）。

## 根本原因

移动端在 Socket.IO 连接后，没有主动请求设备列表。虽然后端在连接时会自动发送一次设备列表，但由于时序问题，移动端可能还没准备好接收。

## 修复方案

### 1. 主动请求设备列表

**文件：** `src/web/App.tsx`

在以下时机主动请求设备列表：

```typescript
// 1. Socket.IO 连接成功时
socketInstance.on('connect', () => {
  console.log('Socket.IO connected');
  socketInstance.emit('set-name', {
    name: settings.deviceName,
    model: navigator.userAgent
  });
  // 主动请求设备列表
  socketInstance.emit('get-devices');
});

// 2. 收到服务器确认连接后
socketInstance.on('connected', (data) => {
  console.log('Connected to server:', data);
  if (data.appVersion) {
    setAppVersion(data.appVersion);
  }
  // 连接成功后再次请求设备列表，确保获取到最新的设备信息
  socketInstance.emit('get-devices');
});

// 3. 重新连接后
socketInstance.on('reconnect', (attemptNumber: number) => {
  console.log('Socket.IO reconnected after', attemptNumber, 'attempts');
  // 重新连接后请求设备列表
  socketInstance.emit('get-devices');
});
```

### 2. 定期刷新设备列表

添加定时器，每 10 秒刷新一次设备列表：

```typescript
// 定期刷新设备列表（每10秒）
const deviceRefreshInterval = setInterval(() => {
  if (socketInstance.connected) {
    socketInstance.emit('get-devices');
  }
}, 10000);

return () => {
  clearInterval(deviceRefreshInterval);
  socketInstance.disconnect();
};
```

### 3. 添加调试日志

**移动端：**
```typescript
socketInstance.on('devices-updated', (data: { devices: Device[] }) => {
  console.log('[Socket.IO] Received devices-updated:', data.devices);
  setDevices(data.devices);
});
```

**后端：**
```typescript
private getDeviceListForMobile(excludeClientId?: string) {
  const devices = [...];
  console.log(`[WebServer] getDeviceListForMobile (exclude: ${excludeClientId}):`, devices);
  return devices;
}

socket.on('get-devices', () => {
  const devices = this.getDeviceListForMobile(clientId);
  console.log(`[WebServer] Client ${clientId} requested devices, sending:`, devices);
  socket.emit('devices-updated', { devices });
});
```

## 测试步骤

### 1. 打开浏览器控制台

在 iOS Safari 或 Chrome 中：
1. 访问 PC 端的 Web 服务器地址（如 `http://192.168.1.5:8080`）
2. 打开开发者工具（Safari: 设置 → Safari → 高级 → 网页检查器）
3. 查看控制台日志

### 2. 检查连接日志

应该看到以下日志：

```
[Socket.IO] Connecting to: http://192.168.1.5:8080
Socket.IO connected
Connected to server: { clientId: "xxx", deviceName: "PC名称", appVersion: "1.0.0" }
[Socket.IO] Received devices-updated: [{ id: "host", name: "PC名称", ... }]
```

### 3. 检查设备列表

- 应该至少看到 PC 端设备（host）
- 如果有其他移动端连接，也应该显示

### 4. 后端日志

在 PC 端的 Electron 应用控制台中，应该看到：

```
[WebServer] Client xxx requested devices, sending: [...]
[WebServer] getDeviceListForMobile (exclude: xxx): [{ id: "host", ... }]
```

## 常见问题排查

### 问题 1：控制台没有任何日志

**可能原因：**
- Socket.IO 连接失败
- 网络问题
- 端口被防火墙阻止

**解决方法：**
1. 检查 PC 和手机是否在同一 WiFi 网络
2. 检查 PC 防火墙设置，允许端口 8080
3. 尝试在浏览器中直接访问 `http://PC_IP:8080`

### 问题 2：连接成功但没有收到设备列表

**可能原因：**
- `get-devices` 事件没有触发
- 后端没有正确响应

**解决方法：**
1. 检查后端日志，看是否收到 `get-devices` 请求
2. 手动在控制台执行：`socket.emit('get-devices')`
3. 检查 Socket.IO 版本兼容性

### 问题 3：收到空的设备列表

**可能原因：**
- `getDeviceListForMobile` 方法有问题
- PC 端设备信息未正确初始化

**解决方法：**
1. 检查后端日志中的设备列表内容
2. 确认 `this.deviceName` 和 `this.getLocalIP()` 返回正确的值
3. 重启 Electron 应用

### 问题 4：iOS Safari 特殊问题

**iOS Safari 可能的限制：**
- WebSocket 连接在后台可能被挂起
- 某些网络环境下 WebSocket 可能被阻止

**解决方法：**
1. 确保应用在前台运行
2. 尝试使用 Chrome for iOS
3. 检查是否启用了"阻止跨站跟踪"（可能影响 WebSocket）

## 优化建议

### 1. 添加手动刷新按钮

在移动端界面添加一个刷新按钮：

```tsx
<button onClick={() => socket?.emit('get-devices')}>
  刷新设备列表
</button>
```

### 2. 显示连接状态

```tsx
const [isConnected, setIsConnected] = useState(false);

socketInstance.on('connect', () => {
  setIsConnected(true);
});

socketInstance.on('disconnect', () => {
  setIsConnected(false);
});

// 在 UI 中显示
{!isConnected && <div>未连接到服务器</div>}
```

### 3. 添加重试机制

如果设备列表为空，自动重试：

```typescript
useEffect(() => {
  if (socket?.connected && devices.length === 0) {
    const retryTimer = setTimeout(() => {
      console.log('[Device Discovery] Retrying get-devices...');
      socket.emit('get-devices');
    }, 2000);
    return () => clearTimeout(retryTimer);
  }
}, [socket, devices]);
```

## 修改文件清单

- ✅ `src/web/App.tsx` - 添加主动请求设备列表逻辑
- ✅ `src/main/services/webServer.ts` - 添加调试日志
- ✅ `IOS_DEVICE_DISCOVERY_FIX.md` - 故障排查文档

## 验证清单

- [ ] iOS Safari 能看到 PC 端设备
- [ ] iOS Chrome 能看到 PC 端设备
- [ ] 重新连接后设备列表正常更新
- [ ] 多个移动端互相能看到对方
- [ ] 控制台日志正常输出
- [ ] 后端日志显示正确的设备列表
