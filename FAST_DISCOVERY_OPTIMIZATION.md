# 设备发现优化方案 - 实现毫秒级识别

## 当前问题分析

### 1. 延迟来源

**桌面端 → 桌面端 (UDP 广播)**
- ✅ 已经很快（<100ms）
- 问题：5秒广播间隔太长
- 问题：首次发现延迟 1 秒

**iOS 浏览器 → 桌面端 (Socket.IO)**
- ✅ 连接速度快
- 问题：需要等待 `devices-updated` 事件
- 问题：3秒刷新间隔

**桌面端 → iOS 浏览器**
- ✅ Socket.IO 推送很快
- 问题：需要等待 `client-connected` 事件传递

### 2. 优化目标

- 桌面端启动后 **500ms 内** 发现其他桌面端
- iOS 连接后 **200ms 内** 被桌面端识别
- 桌面端 **立即** 推送给 iOS 浏览器

---

## 优化方案

### 方案 1: UDP 广播优化（桌面端间）

#### 1.1 快速启动阶段

启动后前 10 秒使用高频广播，之后降低频率：

```typescript
// src/main/services/udpBroadcast.ts

export class UDPBroadcastService extends EventEmitter {
  private readonly FAST_ANNOUNCE_INTERVAL = 500;   // 快速阶段：500ms
  private readonly NORMAL_ANNOUNCE_INTERVAL = 5000; // 正常阶段：5秒
  private readonly FAST_PHASE_DURATION = 10000;     // 快速阶段持续 10 秒
  private startTime: number = 0;

  async start(): Promise<void> {
    // ... 现有代码 ...
    
    this.startTime = Date.now();
    
    // 立即发送 3 次发现请求（间隔 100ms）
    this.sendDiscovery();
    setTimeout(() => this.sendDiscovery(), 100);
    setTimeout(() => this.sendDiscovery(), 200);
    
    // 开始智能广播
    this.startSmartAnnouncing();
  }

  private startSmartAnnouncing(): void {
    const announce = () => {
      this.sendAnnounce();
      
      // 动态调整间隔
      const elapsed = Date.now() - this.startTime;
      const interval = elapsed < this.FAST_PHASE_DURATION 
        ? this.FAST_ANNOUNCE_INTERVAL 
        : this.NORMAL_ANNOUNCE_INTERVAL;
      
      this.announceTimer = setTimeout(announce, interval);
    };
    
    announce();
  }
}
```

#### 1.2 立即响应机制

收到 `discover` 消息后立即响应，不等待下次广播：

```typescript
private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
  // ... 现有代码 ...
  
  // 如果收到发现请求，立即响应（已实现）
  if (message.type === 'discover') {
    this.sendResponse(rinfo.address);
  }
  
  // 如果收到响应，立即添加设备（已实现）
  if (message.type === 'response' || message.type === 'announce') {
    const device: BroadcastDevice = {
      id: message.id,
      name: message.name,
      ip: rinfo.address,
      port: message.port,
      type: 'desktop',
      lastSeen: Date.now()
    };
    
    const isNew = !this.devices.has(device.id);
    this.devices.set(device.id, device);
    
    if (isNew) {
      console.log('[UDP] 新设备 <100ms:', device.name);
      this.emit('device-found', device);
    }
  }
}
```

---

### 方案 2: Socket.IO 优化（iOS ↔ 桌面端）

#### 2.1 立即推送机制

iOS 连接后立即推送设备列表，不等待请求：

```typescript
// src/main/services/webServer.ts

private handleSocketConnection(socket: Socket) {
  const ip = (socket.handshake.address || '').replace('::ffff:', '');
  
  // ... 现有代码 ...
  
  // ✅ 立即发送设备列表（不等待 get-devices 请求）
  const devices = this.getDeviceListForMobile(clientId);
  socket.emit('devices-updated', { devices });
  console.log('[WebServer] 立即推送设备列表:', devices.length);
  
  // ✅ 立即通知桌面端（已实现）
  this.emit('client-connected', { 
    id: clientId, 
    name: clientName, 
    model: client.model || '', 
    ip 
  });
  
  // ... 其他事件监听 ...
}
```

#### 2.2 减少轮询间隔

```typescript
// src/web/hooks/useSocket.ts

// 从 3 秒改为 1 秒（快速阶段）
const deviceRefreshInterval = setInterval(() => {
  if (socketInstance.connected) {
    socketInstance.emit('get-devices');
  }
}, 1000); // 1秒刷新

// 10 秒后降低频率
setTimeout(() => {
  clearInterval(deviceRefreshInterval);
  const slowRefreshInterval = setInterval(() => {
    if (socketInstance.connected) {
      socketInstance.emit('get-devices');
    }
  }, 5000); // 5秒刷新
  
  // 清理函数中也要清除这个定时器
}, 10000);
```

#### 2.3 增量更新支持

实现真正的增量更新，避免全量刷新：

```typescript
// src/web/hooks/useSocket.ts

// 使用 Map 存储设备，支持增量更新
const devicesMapRef = useRef<Map<string, Device>>(new Map());

socketInstance.on('device-added', (device: Device) => {
  console.log('[Socket.IO] 设备上线:', device.name);
  devicesMapRef.current.set(device.id, device);
  callbacksRef.current.onDevicesUpdate(Array.from(devicesMapRef.current.values()));
});

socketInstance.on('device-removed', (deviceId: string) => {
  console.log('[Socket.IO] 设备离线:', deviceId);
  devicesMapRef.current.delete(deviceId);
  callbacksRef.current.onDevicesUpdate(Array.from(devicesMapRef.current.values()));
});

socketInstance.on('device-updated', (device: Device) => {
  console.log('[Socket.IO] 设备更新:', device.name);
  devicesMapRef.current.set(device.id, device);
  callbacksRef.current.onDevicesUpdate(Array.from(devicesMapRef.current.values()));
});
```

---

### 方案 3: 服务端增量推送

修改 WebServer 支持增量推送：

```typescript
// src/main/services/webServer.ts

export class WebFileServer extends EventEmitter {
  // 广播设备变化（增量）
  private broadcastDeviceAdded(device: any) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.socket.connected && clientId !== device.id) {
        client.socket.emit('device-added', device);
      }
    }
  }

  private broadcastDeviceRemoved(deviceId: string) {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.socket.connected) {
        client.socket.emit('device-removed', deviceId);
      }
    }
  }

  // 在 handleSocketConnection 中
  private handleSocketConnection(socket: Socket) {
    // ... 现有代码 ...
    
    // 新客户端连接，通知其他客户端
    this.broadcastDeviceAdded({ 
      id: clientId, 
      name: clientName, 
      model: client.model || '', 
      ip, 
      type: 'mobile' 
    });
    
    // 断开连接时通知
    socket.on('disconnect', () => {
      // ... 现有代码 ...
      this.broadcastDeviceRemoved(clientId);
    });
  }

  // 在 ServiceManager 的 UDP 事件中
  updateLANDevice(device: LANDevice) {
    const isNew = !this.lanDevices.has(device.id);
    this.lanDevices.set(device.id, device);
    
    if (isNew) {
      // 新设备，增量推送
      this.broadcastDeviceAdded({ ...device, type: 'pc' });
    } else {
      // 更新设备
      this.broadcastDeviceList(); // 或实现 broadcastDeviceUpdated
    }
  }
}
```

---

### 方案 4: 前端优化

#### 4.1 预加载缓存

```typescript
// src/web/hooks/useSocket.ts

// 已实现：立即加载缓存
const cached = localStorage.getItem(DEVICES_CACHE_KEY);
if (cached) {
  const { devices, timestamp } = JSON.parse(cached);
  const age = Date.now() - timestamp;
  
  if (age < CACHE_EXPIRY_MS) {
    console.log('[Socket.IO] 缓存设备:', devices.length);
    callbacksRef.current.onDevicesUpdate(devices);
  }
}
```

#### 4.2 乐观更新

```typescript
// 发送文件时立即显示进度，不等待服务器确认
const handleSendFile = async (file: File, targetId: string) => {
  // 乐观更新：立即显示 0% 进度
  setSendProgress({
    percent: 0,
    currentFile: file.name,
    totalSize: file.size,
    sentSize: 0
  });
  
  // 实际发送
  await socket.emit('send-file', { file, targetId });
};
```

---

## 实施优先级

### 🔥 高优先级（立即实施）

1. **UDP 快速启动**：前 10 秒使用 500ms 间隔
2. **Socket.IO 立即推送**：连接后立即发送设备列表
3. **减少轮询间隔**：前 10 秒使用 1 秒间隔

### 🟡 中优先级（1-2 天）

4. **增量更新**：实现 `device-added/removed/updated` 事件
5. **服务端增量推送**：WebServer 支持增量广播

### 🟢 低优先级（优化阶段）

6. **乐观更新**：前端立即显示状态变化
7. **心跳优化**：动态调整心跳频率

---

## 预期效果

### 优化前
- 桌面端 → 桌面端：1-5 秒
- iOS → 桌面端：1-3 秒
- 桌面端 → iOS：立即（已经很快）

### 优化后
- 桌面端 → 桌面端：**100-500ms** ⚡
- iOS → 桌面端：**200-500ms** ⚡
- 桌面端 → iOS：**<100ms** ⚡

---

## 测试方法

### 1. 桌面端间发现测试

```bash
# 终端 1
npm run dev

# 终端 2（另一台电脑）
npm run dev

# 观察日志，记录发现时间
```

### 2. iOS 发现测试

```bash
# 桌面端
npm run dev

# iOS Safari
# 打开 Web URL
# 使用 Safari 开发者工具查看日志
```

### 3. 性能监控

```typescript
// 添加性能日志
console.time('[Discovery] Device found');
// ... 发现逻辑 ...
console.timeEnd('[Discovery] Device found');
```

---

## 注意事项

1. **电池消耗**：高频广播会增加电池消耗，移动端应使用较低频率
2. **网络负载**：500ms 间隔在大型网络中可能造成拥塞，建议限制在前 10 秒
3. **缓存一致性**：使用缓存时要注意过期策略
4. **增量更新**：确保客户端和服务端状态同步

---

**实施建议**：先实施高优先级优化，测试效果后再考虑中低优先级优化。
