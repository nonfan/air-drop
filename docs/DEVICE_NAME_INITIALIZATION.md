# 网页端设备名称初始化修复

## 问题描述

网页端在连接到桌面端时，设备名称未正确初始化和发送，导致：
1. 桌面端无法识别网页端设备
2. 设备列表显示默认名称（如 "手机 xxx"）
3. 必须进入设置页面才能被正确发现

## 根本原因

设备名称的初始化逻辑分散在多个地方：
- `useSettings` hook 负责读取和保存设置
- 设置页面负责修改设备名称
- 但没有统一的初始化入口

导致在首次连接时，设备名称可能未初始化就尝试连接。

## 解决方案

### 1. 重构设置管理 Hook (`src/web/hooks/useSettings.ts`)

**变更：**
- 移除自动初始化逻辑
- 添加 `initializeSettings(deviceName)` 方法供外部调用
- `useSettings` 只负责读取和更新设置，不负责初始化

**代码：**
```typescript
export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  // 初始化设置（由 App.tsx 调用）
  const initializeSettings = useCallback((deviceName: string) => {
    const savedSettings = getStorageItem<Settings>(STORAGE_KEYS.SETTINGS, null);
    
    if (savedSettings) {
      // 如果有保存的设置，使用保存的设备名称
      setSettings(savedSettings);
    } else {
      // 首次使用，创建默认设置
      const initialSettings: Settings = {
        ...DEFAULT_SETTINGS,
        deviceName
      };
      setStorageItem(STORAGE_KEYS.SETTINGS, initialSettings);
      setSettings(initialSettings);
    }
  }, []);

  return {
    settings,
    saveSettings,
    initializeSettings
  };
}
```

### 2. 在 App.tsx 中统一初始化 (`src/web/App.tsx`)

**变更：**
- 在组件挂载时检查设置是否已加载
- 如果未加载，生成设备名称并调用 `initializeSettings`
- 在设置加载完成前显示加载状态
- Socket.IO 连接只在设备名称初始化后才建立

**代码：**
```typescript
// 初始化设备名称（只在首次加载时执行）
useEffect(() => {
  if (!settings) {
    // 生成设备名称
    const deviceName = `Web-${Math.random().toString(36).slice(2, 8)}`;
    initializeSettings(deviceName);
    console.log('[App] Initialized device name:', deviceName);
  }
}, [settings, initializeSettings]);

// 如果设置还未加载，显示加载状态
if (!settings) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'var(--bg-primary)'
    }}>
      <div>正在初始化...</div>
    </div>
  );
}
```

### 3. Socket.IO 连接优化 (`src/web/hooks/useSocket.ts`)

**变更：**
- 添加设备名称检查，空名称时不连接
- 在连接时通过 query 参数发送设备名称
- 连接后立即调用 `set-name` 确保服务器端更新

**代码：**
```typescript
useEffect(() => {
  // 如果设备名称为空，不连接
  if (!deviceName) {
    console.log('[Socket.IO] Device name not set, skipping connection');
    return;
  }

  const socketInstance = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    query: {
      deviceName: deviceName  // 在连接时就发送设备名称
    }
  });

  socketInstance.on('connect', () => {
    // 立即设置设备名称
    socketInstance.emit('set-name', {
      name: deviceName,
      model: navigator.userAgent
    });
  });
}, [deviceName]);
```

### 4. 服务器端处理 (`src/main/services/webServer.ts`)

**已有逻辑（无需修改）：**
- 从握手数据中读取设备名称：`handshakeData.deviceName`
- 如果没有提供，使用默认名称：`手机 ${ip.split('.').pop()}`
- 监听 `set-name` 事件更新设备名称

**代码：**
```typescript
private handleSocketConnection(socket: Socket) {
  const handshakeData = socket.handshake.query;
  let clientName = (handshakeData.deviceName as string) || `手机 ${ip.split('.').pop()}`;
  
  // 设置设备名称
  socket.on('set-name', (data: { name: string; model?: string }) => {
    clientName = data.name || clientName;
    client.name = clientName;
    this.broadcastDeviceList();
  });
}
```

## 执行流程

### 首次访问
1. App.tsx 挂载，`settings` 为 `null`
2. useEffect 检测到 `settings` 为空
3. 生成设备名称：`Web-xxxxxx`
4. 调用 `initializeSettings(deviceName)`
5. 保存到 localStorage 并更新 state
6. `settings` 不再为 `null`，组件重新渲染
7. useSocket 检测到 `deviceName` 不为空，建立连接
8. 连接时通过 query 参数发送设备名称
9. 连接成功后调用 `set-name` 确保服务器端更新
10. 桌面端收到正确的设备名称

### 再次访问
1. App.tsx 挂载，`settings` 为 `null`
2. useEffect 检测到 `settings` 为空
3. 调用 `initializeSettings`
4. 从 localStorage 读取已保存的设置（包含设备名称）
5. 更新 state，`settings` 不再为 `null`
6. useSocket 使用已保存的设备名称建立连接
7. 桌面端收到正确的设备名称

### 修改设备名称
1. 用户在设置页面修改设备名称
2. 调用 `saveSettings({ deviceName: newName })`
3. 更新 localStorage 和 state
4. useSocket 的 useEffect 检测到 `deviceName` 变化
5. 断开旧连接，使用新名称重新连接
6. 桌面端收到更新后的设备名称

## 关键改进

1. **单一职责原则**
   - `useSettings`：只负责读取和保存设置
   - `App.tsx`：负责初始化逻辑
   - `useSocket`：负责连接管理

2. **加载状态管理**
   - 在设置加载前显示加载界面
   - 避免使用未初始化的设置

3. **空值检查**
   - useSocket 检查设备名称是否为空
   - 避免使用空名称建立连接

4. **双重保障**
   - 连接时通过 query 参数发送设备名称
   - 连接后通过 `set-name` 事件再次确认

## 测试验证

### 测试场景 1：首次访问
- [ ] 打开网页端
- [ ] 检查控制台日志：`[App] Initialized device name: Web-xxxxxx`
- [ ] 检查控制台日志：`[Socket.IO] Connecting to fixed IP: ... with device name: Web-xxxxxx`
- [ ] 桌面端设备列表显示正确的设备名称（Web-xxxxxx）

### 测试场景 2：刷新页面
- [ ] 刷新网页端
- [ ] 设备名称保持不变
- [ ] 桌面端设备列表显示相同的设备名称

### 测试场景 3：修改设备名称
- [ ] 进入设置页面
- [ ] 修改设备名称为 "我的手机"
- [ ] 保存设置
- [ ] 桌面端设备列表更新为 "我的手机"

### 测试场景 4：清除缓存后访问
- [ ] 清除浏览器 localStorage
- [ ] 刷新页面
- [ ] 生成新的设备名称
- [ ] 桌面端显示新的设备名称

## 相关文件

- `src/web/App.tsx` - 设备名称初始化入口
- `src/web/hooks/useSettings.ts` - 设置管理 Hook
- `src/web/hooks/useSocket.ts` - Socket.IO 连接管理
- `src/main/services/webServer.ts` - 服务器端设备管理

## 版本信息

- 修复版本：v1.10.1（待发布）
- 修复日期：2026-02-04
- 相关 Issue：网页端必须进入设置页面才能被发现
