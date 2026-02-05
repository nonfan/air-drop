# 端口配置文档

## 端口配置概览

应用使用以下端口进行不同服务的通信：

| 端口 | 服务 | 用途 | 配置文件 |
|------|------|------|----------|
| 5173 | Vite Dev Server | Electron 渲染进程开发 | 多个文件 |
| 8888 | Web Server (Socket.IO) | 移动端连接 | src/main/config.ts |
| 3001 | Transfer Server | 桌面端文件传输 | src/main/config.ts |

## Vite 开发服务器端口 (5173)

### ⚠️ 重要：端口同步

修改 Vite 开发服务器端口时，**必须同步更新以下 3 个文件**：

#### 1. package.json
```json
{
  "scripts": {
    "dev:electron": "wait-on http://localhost:5173 && ..."
  }
}
```
**位置**: `dev:electron` 脚本中的 `wait-on` URL

#### 2. vite.config.ts
```typescript
export default defineConfig({
  server: {
    port: 5173,
    // ...
  }
})
```
**位置**: `server.port` 配置

#### 3. src/main/window.ts
```typescript
const VITE_DEV_PORT = 5173;
const VITE_DEV_URL = `http://localhost:${VITE_DEV_PORT}`;
await mainWindow.loadURL(VITE_DEV_URL);
```
**位置**: `createMainWindow` 函数中的开发模式 URL

### 端口修改步骤

如果需要修改 Vite 开发服务器端口（例如改为 5174）：

1. **修改 vite.config.ts**
   ```typescript
   server: {
     port: 5174,  // 修改这里
     // ...
   }
   ```

2. **修改 package.json**
   ```json
   "dev:electron": "wait-on http://localhost:5174 && ..."
   ```

3. **修改 src/main/window.ts**
   ```typescript
   const VITE_DEV_PORT = 5174;  // 修改这里
   ```

4. **验证配置**
   ```bash
   npm run check-ports
   ```

5. **测试启动**
   ```bash
   npm run dev
   ```

## Web 服务器端口 (8888)

### 配置位置

#### 主进程配置
```typescript
// src/main/config.ts
export const APP_CONFIG = {
  PORTS: {
    WEB_SERVER: 8888
  }
}
```

#### Web 端配置
```typescript
// src/web/config.ts
export const WEB_CONFIG = {
  FIXED_IP: {
    HOST: '192.168.0.2',
    PORT: 8888
  }
}
```

### 修改步骤

1. 修改 `src/main/config.ts` 中的 `WEB_SERVER` 端口
2. 修改 `src/web/config.ts` 中的 `PORT` 配置
3. 重新编译和启动应用

## 传输服务器端口 (3001)

### 配置位置

```typescript
// src/main/config.ts
export const APP_CONFIG = {
  PORTS: {
    TRANSFER_SERVER: 3001
  }
}
```

### 特性

- 端口会自动递增查找可用端口
- 如果 3001 被占用，会尝试 3002, 3003 等

## 端口冲突处理

### 检查端口占用

#### Windows
```bash
netstat -ano | findstr :5173
netstat -ano | findstr :8888
netstat -ano | findstr :3001
```

#### 终止占用进程
```bash
taskkill /F /PID <进程ID>
```

### 常见端口冲突

#### Vite 端口 (5173) 被占用
**症状**: Electron 窗口显示空白或连接失败

**解决方案**:
1. 检查是否有其他 Vite 实例在运行
2. 终止占用进程
3. 或修改端口配置（参考上面的步骤）

#### Web 服务器端口 (8888) 被占用
**症状**: 移动端无法连接

**解决方案**:
1. 检查是否有其他应用使用 8888 端口
2. 终止占用进程
3. 或修改 Web 服务器端口

## 开发工具

### 端口检查脚本

运行以下命令检查端口配置：
```bash
npm run check-ports
```

### 诊断脚本

运行诊断脚本检查所有端口状态：
```bash
diagnose.bat
```

## 最佳实践

### 1. 使用标准端口
- Vite: 5173 (默认)
- Web Server: 8888 (常用)
- Transfer Server: 3001 (自定义)

### 2. 避免常用端口
避免使用以下常用端口：
- 80, 443 (HTTP/HTTPS)
- 3000 (常见开发服务器)
- 8080 (常见代理服务器)
- 5000 (Flask 等)

### 3. 文档同步
修改端口后，更新以下文档：
- README.md
- 本文档
- 相关配置文档

### 4. 团队协作
- 在团队中统一端口配置
- 提交代码前检查端口配置
- 在 PR 中说明端口变更

## 故障排查

### Electron 窗口空白

**可能原因**:
1. Vite 未启动
2. 端口配置不一致
3. 端口被占用

**检查步骤**:
1. 查看终端输出，确认 Vite 启动成功
2. 检查三个文件的端口配置是否一致
3. 使用 `netstat` 检查端口占用
4. 查看 Electron 控制台错误信息

### 移动端无法连接

**可能原因**:
1. Web 服务器未启动
2. IP 地址配置错误
3. 防火墙阻止连接

**检查步骤**:
1. 确认 Web 服务器启动成功（查看日志）
2. 检查 IP 地址配置（src/web/config.ts）
3. 检查防火墙设置
4. 确认设备在同一网络

## 配置模板

### 开发环境配置
```typescript
// 开发环境使用默认端口
const DEV_PORTS = {
  VITE: 5173,
  WEB_SERVER: 8888,
  TRANSFER_SERVER: 3001
};
```

### 生产环境配置
```typescript
// 生产环境可以使用不同端口
const PROD_PORTS = {
  WEB_SERVER: 8888,
  TRANSFER_SERVER: 3001
};
```

## 相关文档

- [Electron 框架修复](./ELECTRON_FIXES.md)
- [开发环境设置](./DEV_SETUP.md)
- [依赖清理文档](./DEPENDENCY_CLEANUP.md)

## 总结

端口配置是应用正常运行的关键。修改端口时务必保持所有配置文件同步，并进行充分测试。使用提供的检查脚本和诊断工具可以快速发现和解决端口配置问题。
