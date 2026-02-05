# 开发环境设置

## 问题：Vite 权限错误

如果遇到 `Error: listen EACCES: permission denied` 错误，这是 Windows 权限问题。

## 解决方案

### 方案 1：使用 dev.bat（推荐）

直接运行项目根目录的 `dev.bat` 脚本：

```bash
dev.bat
```

这个脚本会：
1. 清理现有进程
2. 清理端口占用
3. 编译主进程
4. 同时启动 Vite 和 Electron

### 方案 2：以管理员身份运行

1. 右键点击 VS Code
2. 选择"以管理员身份运行"
3. 在 VS Code 终端中运行：
   ```bash
   npm run dev
   ```

### 方案 3：测试 Vite

如果不确定 Vite 能否启动，先运行测试脚本：

```bash
test-vite.bat
```

如果 Vite 能成功启动并显示端口号，说明环境正常。

## 端口配置

- **Vite 开发服务器**: 5555（如果被占用会自动换端口）
- **Web Socket.IO 服务器**: 8888
- **传输服务器**: 3001

## 常见问题

### 1. 端口被占用

**症状**: `Error: listen EACCES` 或 `EADDRINUSE`

**解决**:
```bash
# 查看占用端口的进程
netstat -ano | findstr :5555

# 终止进程（替换 PID）
taskkill /F /PID <PID>
```

### 2. Electron 无法连接到 Vite

**症状**: Electron 窗口空白或显示 "ERR_CONNECTION_REFUSED"

**原因**: Vite 还没启动完成

**解决**: 
- 使用 `dev.bat`，它会等待 3 秒
- 或者手动先启动 Vite，再启动 Electron

### 3. PeerJS 错误

**症状**: `Error: The current browser does not support WebRTC`

**说明**: 这是正常的！PeerJS 在 Node.js 环境（主进程）中会报错，但在浏览器环境（渲染进程）中正常工作。可以忽略这个错误。

## 开发流程

### 启动开发环境

```bash
# 方式 1: 使用脚本（推荐）
dev.bat

# 方式 2: 使用 npm
npm run dev
```

### 只启动 Web 端

```bash
npm run dev:web
```

### 构建生产版本

```bash
npm run build
npm run start
```

### 打包应用

```bash
npm run dist
```

## 文件结构

```
项目根目录/
├── dev.bat              # 开发启动脚本
├── test-vite.bat        # Vite 测试脚本
├── package.json         # npm 脚本配置
├── vite.config.ts       # Vite 配置（渲染进程）
├── vite.config.web.ts   # Vite 配置（Web 端）
└── src/
    ├── main/            # Electron 主进程
    ├── renderer/        # Electron 渲染进程
    └── web/             # Web 端
```

## 调试技巧

### 查看 Vite 输出

Vite 的输出会显示在终端中，包括：
- 启动的端口号
- 编译错误
- 热更新信息

### 查看 Electron 日志

Electron 的日志会显示在：
- 终端（主进程日志）
- 开发者工具控制台（渲染进程日志）

### 开发者工具

开发模式下会自动打开 Electron DevTools，可以：
- 查看控制台日志
- 调试 React 组件
- 检查网络请求
- 查看应用状态

## 性能优化

### 加快启动速度

1. 使用 `dev.bat` 而不是 `npm run dev`
2. 确保没有其他 Node.js 进程占用资源
3. 关闭不必要的应用程序

### 减少编译时间

TypeScript 编译可能较慢，可以：
1. 只修改渲染进程代码时，不需要重新编译主进程
2. 使用增量编译（已配置）

## 故障排除

如果遇到问题：

1. **清理并重新安装依赖**
   ```bash
   rmdir /s /q node_modules
   del package-lock.json
   npm install
   ```

2. **清理构建产物**
   ```bash
   rmdir /s /q dist
   ```

3. **重启 VS Code**
   有时 TypeScript 服务器会卡住

4. **检查 Node.js 版本**
   ```bash
   node --version  # 应该是 v20.x 或更高
   ```

## 相关文件

- `vite.config.ts` - Vite 配置
- `tsconfig.main.json` - 主进程 TypeScript 配置
- `package.json` - npm 脚本和依赖
- `src/main/window.ts` - 窗口创建和端口配置
