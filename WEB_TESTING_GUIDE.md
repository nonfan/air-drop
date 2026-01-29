# 网页端测试指南

## 问题已修复 ✅

已修复网页端 Socket.IO 连接问题。现在网页端可以正确连接到服务器并发现设备。

---

## 测试方法

### 方法 1：开发模式测试（推荐用于调试）

1. **启动桌面端应用**
   ```bash
   npm run dev
   ```
   
   查看控制台，确认服务器启动：
   ```
   Web server with Socket.IO started on http://0.0.0.0:80
   Web server running at http://192.168.1.5:80
   ```

2. **启动 Web 开发服务器**
   ```bash
   npm run dev:web
   ```
   
   查看输出：
   ```
   ➜  Local:   http://localhost:5174/
   ➜  Network: http://192.168.1.5:5174/
   ```

3. **在浏览器中打开**
   - 电脑浏览器：`http://localhost:5174/`
   - 手机浏览器：`http://192.168.1.5:5174/`（确保手机和电脑在同一 Wi-Fi）

4. **查看浏览器控制台**
   - 按 `F12` 打开开发者工具
   - 切换到 Console 标签页
   - 应该看到：
     ```
     [Socket.IO] Connecting to: http://localhost:8080
     Socket.IO connected
     Connected to server: {clientId: "...", deviceName: "Airdrop-Win", appVersion: "1.6.0"}
     ```

5. **检查设备列表**
   - 网页端应该显示桌面端设备（Airdrop-Win）
   - 不再显示"未发现设备"

---

### 方法 2：生产模式测试（真实使用场景）

1. **构建 Web 应用**
   ```bash
   npm run build:web
   ```

2. **启动桌面端应用**
   ```bash
   npm run dev
   ```
   
   或者使用打包后的应用：
   ```bash
   npm run dist
   ```

3. **在手机上访问**
   - 打开手机浏览器
   - 访问：`http://192.168.1.5:80`（替换为你的电脑 IP）
   - 或者扫描桌面端应用显示的二维码

4. **测试功能**
   - 查看设备列表（应该显示桌面端）
   - 发送文件
   - 发送文本
   - 查看传输历史

---

## 修复内容

### 1. Socket.IO 连接配置

**问题：** 开发模式下，Vite 开发服务器运行在 5174 端口，但 Socket.IO 服务器运行在 80/8080 端口。网页端尝试连接到 `window.location.origin`（5174 端口），导致连接失败。

**解决方案：** 在 `src/web/App.tsx` 中添加环境检测：

```typescript
// 在开发模式下，Socket.IO 服务器运行在不同的端口
const isDev = import.meta.env.DEV;
const socketUrl = isDev 
  ? 'http://localhost:8080'  // 开发模式：连接到 Electron 的 webServer
  : window.location.origin;   // 生产模式：连接到当前页面的服务器

const socketInstance = io(socketUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 3000,
  reconnectionAttempts: Infinity
});
```

### 2. 修复 handleSendFiles 中的变量引用

**问题：** 代码中使用了 `ws`（旧的 WebSocket 变量），但应该使用 `socket`（Socket.IO）。

**解决方案：** 将 `if (!ws || ...)` 改为 `if (!socket || ...)`

---

## 预期结果

### 开发模式

**桌面端控制台：**
```
[ServiceManager] Bonjour discovery started successfully
Web server with Socket.IO started on http://0.0.0.0:80
Web server running at http://192.168.1.5:80
```

**网页端控制台：**
```
[Socket.IO] Connecting to: http://localhost:8080
Socket.IO connected
Connected to server: {clientId: "xxx", deviceName: "Airdrop-Win", appVersion: "1.6.0"}
```

**网页端 UI：**
- ✅ 显示设备列表
- ✅ 可以选择桌面端设备
- ✅ 可以发送文件和文本
- ✅ 可以查看传输历史

### 生产模式

**手机浏览器：**
- ✅ 访问 `http://192.168.1.5:80` 成功
- ✅ 自动连接到 Socket.IO 服务器
- ✅ 显示桌面端设备
- ✅ 所有功能正常工作

---

## 常见问题

### Q1: 开发模式下网页端仍然无法连接

**检查：**
1. 桌面端应用是否正在运行？
2. 服务器是否启动在 80 或 8080 端口？
3. 浏览器控制台显示什么错误？

**解决：**
- 确保先启动桌面端应用（`npm run dev`）
- 然后启动 web 开发服务器（`npm run dev:web`）
- 检查防火墙是否阻止了 80/8080 端口

### Q2: 手机无法访问网页端

**检查：**
1. 手机和电脑是否在同一 Wi-Fi？
2. 电脑的 IP 地址是什么？（运行 `ipconfig`）
3. 防火墙是否允许 80 端口？

**解决：**
```powershell
# 允许 80 端口
New-NetFirewallRule -DisplayName "Airdrop Web" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

### Q3: 显示"未发现设备"

**检查：**
1. Socket.IO 是否连接成功？（查看浏览器控制台）
2. 桌面端应用是否正在运行？

**解决：**
- 刷新网页
- 重启桌面端应用
- 查看桌面端控制台是否有错误

---

## 调试技巧

### 1. 查看 Socket.IO 连接状态

在浏览器控制台输入：
```javascript
// 查看 Socket.IO 连接状态
console.log('Socket connected:', socket?.connected);
console.log('Socket ID:', socket?.id);
```

### 2. 查看设备列表

在浏览器控制台输入：
```javascript
// 查看当前设备列表
console.log('Devices:', devices);
```

### 3. 手动触发设备列表更新

在浏览器控制台输入：
```javascript
// 手动请求设备列表
socket?.emit('get-devices');
```

---

## 下一步

测试完成后，请告诉我：

1. ✅ 网页端是否能成功连接到服务器？
2. ✅ 是否能看到桌面端设备？
3. ✅ 能否成功发送文件和文本？
4. ❓ 有没有其他问题或错误？

---

## 技术细节

### 开发模式架构

```
┌─────────────────────┐
│  Vite Dev Server    │  http://localhost:5174
│  (网页前端)          │  提供 HTML/JS/CSS
└──────────┬──────────┘
           │
           │ Socket.IO 连接
           ↓
┌─────────────────────┐
│  Electron App       │  http://localhost:80
│  (WebFileServer)    │  Socket.IO 服务器
└─────────────────────┘
```

### 生产模式架构

```
┌─────────────────────┐
│  手机浏览器          │  http://192.168.1.5:80
│                     │  访问网页 + Socket.IO
└──────────┬──────────┘
           │
           │ HTTP + Socket.IO
           ↓
┌─────────────────────┐
│  Electron App       │  http://192.168.1.5:80
│  (WebFileServer)    │  提供网页 + Socket.IO 服务器
└─────────────────────┘
```

### Socket.IO 事件流程

```
客户端连接
    ↓
服务器发送 'connected' 事件
    ↓
服务器发送 'devices-updated' 事件
    ↓
客户端显示设备列表
    ↓
用户选择设备并发送文件
    ↓
服务器接收文件并转发
    ↓
目标设备收到 'file-received' 事件
```
