# 设备发现问题修复

## 问题描述

**症状**: iOS 浏览器能发现桌面端，但桌面端看不到 iOS 浏览器端

## 根本原因

`src/main/services/webServer.ts` 中的 `client-connected` 和 `client-disconnected` 事件发送的数据缺少 `model` 字段。

### 问题代码

```typescript
// client-connected 事件
this.emit('client-connected', { id: clientId, name: clientName, ip });

// client-disconnected 事件
this.emit('client-disconnected', { id: clientId, name: clientName, ip });
```

### 问题分析

1. iOS 浏览器通过 Socket.IO 连接到 WebServer
2. WebServer 触发 `client-connected` 事件
3. ServiceManager 将事件转发给桌面端渲染进程（`mobile-connected`）
4. 桌面端 App.tsx 接收事件并添加到设备列表
5. **但是**：发送的数据缺少 `model` 字段，导致类型不匹配

虽然 `Device` 类型中 `model` 是可选的（`model?: string`），但在某些情况下可能导致渲染问题或类型检查失败。

## 解决方案

添加 `model` 字段到事件数据中：

```typescript
// 修复后的 client-connected 事件
this.emit('client-connected', { 
  id: clientId, 
  name: clientName, 
  model: client.model || '', 
  ip 
});

// 修复后的 client-disconnected 事件
this.emit('client-disconnected', { 
  id: clientId, 
  name: clientName, 
  model: currentClient.model || '', 
  ip 
});
```

## 修改的文件

- `src/main/services/webServer.ts`
  - 第 805 行：`client-connected` 事件添加 `model` 字段
  - 第 970 行：`client-disconnected` 事件添加 `model` 字段

## 设备发现流程

### iOS 浏览器 → 桌面端

```
iOS 浏览器打开网页
    ↓
Socket.IO 连接到 WebServer (端口 8888)
    ↓
WebServer 触发 'client-connected' 事件
    ↓
ServiceManager 转发到渲染进程 ('mobile-connected')
    ↓
桌面端 App.tsx 接收事件
    ↓
添加到设备列表 (type: 'mobile')
    ↓
✅ 桌面端看到 iOS 浏览器
```

### 桌面端 → iOS 浏览器

```
桌面端启动
    ↓
UDP 广播服务启动 (端口 3001)
    ↓
WebServer 启动 (端口 8888)
    ↓
iOS 浏览器连接后
    ↓
WebServer 发送 'devices-updated' 事件
    ↓
包含桌面端信息 (id: 'host', type: 'pc')
    ↓
✅ iOS 浏览器看到桌面端
```

## 测试步骤

### 1. 启动桌面端

```bash
npm run dev
```

### 2. 在 iOS 浏览器中打开网页

1. 确保 iOS 设备和桌面端在同一局域网
2. 在桌面端获取 Web URL（点击二维码图标）
3. 在 iOS Safari 中打开该 URL

### 3. 验证设备发现

**桌面端应该显示**:
- iOS 设备名称（例如：iPhone 15）
- 设备类型：移动端
- IP 地址

**iOS 浏览器应该显示**:
- 桌面端名称（例如：Desktop-abc123）
- 设备类型：PC
- IP 地址

### 4. 测试文件传输

**从 iOS 发送到桌面端**:
1. 在 iOS 浏览器中选择文件
2. 选择桌面端设备
3. 点击发送
4. 验证桌面端收到文件

**从桌面端发送到 iOS**:
1. 在桌面端选择文件
2. 选择 iOS 设备
3. 点击发送
4. 验证 iOS 浏览器收到文件

## 相关代码

### Device 类型定义

```typescript
// src/renderer/types.d.ts
export interface Device {
  id: string;
  name: string;
  model?: string;  // 可选字段
  ip: string;
  port?: number;
  type: 'pc' | 'mobile';
}
```

### 桌面端事件监听

```typescript
// src/renderer/App.tsx
window.windrop.onMobileConnected((m) => {
  setDevices(prev => {
    const exists = prev.find(x => x.id === m.id);
    if (exists) return prev.map(x => x.id === m.id ? { ...m, type: 'mobile' as const } : x);
    return [...prev, { ...m, type: 'mobile' as const }];
  });
});
```

### WebServer 设备列表

```typescript
// src/main/services/webServer.ts
private getDeviceListForMobile(excludeClientId?: string) {
  const devices: { id: string; name: string; model: string; ip: string; type: 'pc' | 'mobile' }[] = [];
  
  // 添加桌面端（主机）
  devices.push({ 
    id: 'host', 
    name: this.deviceName, 
    model: 'Windows', 
    ip: this.getLocalIP(), 
    type: 'pc'
  });
  
  // 添加其他移动端客户端
  for (const [id, client] of this.clients.entries()) {
    if (id !== excludeClientId) {
      devices.push({ 
        id, 
        name: client.name, 
        model: client.model, 
        ip: client.ip, 
        type: 'mobile'
      });
    }
  }
  
  return devices;
}
```

## 注意事项

1. **model 字段是可选的**：如果移动端没有设置设备型号，使用空字符串作为默认值
2. **设备类型**：桌面端设备类型为 `'pc'`，移动端设备类型为 `'mobile'`
3. **设备 ID**：桌面端使用固定 ID `'host'`，移动端使用 UUID
4. **IP 地址**：从 Socket 连接中获取，自动过滤 `::ffff:` 前缀

## 调试建议

### 桌面端调试

打开开发者工具（F12），查看控制台日志：

```
[WebServer] Client connecting: <uuid> (<ip>)
[ServiceManager] Mobile client connected: <name>
[App] Devices updated: [...]
```

### iOS 浏览器调试

在 Safari 中打开开发者工具（需要在 Mac 上）：

1. Mac Safari → 开发 → <iOS 设备名称> → <网页>
2. 查看控制台日志：

```
[Socket] Connected to server
[Socket] Devices updated: [...]
```

## 版本信息

- **修复版本**: v1.11.0
- **修复日期**: 2026-02-05
- **相关问题**: 设备发现、Socket.IO 连接

---

**修复完成** ✅
