# Airdrop - 跨平台局域网文件传输工具

## 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式

**方式 1：一键启动（推荐）**
```bash
dev.bat
```

**方式 2：手动启动**
```bash
# 终端 1 - Vite 开发服务器
vite

# 终端 2 - Electron 应用
npm run dev
```

### 生产模式

**构建并启动**
```bash
npm start
```

**仅构建**
```bash
npm run build
```

**打包应用**
```bash
npm run dist
```

### 开发 Web 端
```bash
npm run dev:web
```

## 核心命令

| 命令 | 说明 |
|------|------|
| `dev.bat` | 开发模式一键启动 |
| `npm run dev` | 快速启动 Electron |
| `npm run dev:web` | 开发 Web 端 |
| `npm run build` | 构建完整项目 |
| `npm start` | 构建并启动 |
| `npm run dist` | 打包应用 |
| `npm test` | 运行测试 |
| `npm run check-ports` | 检查端口配置 |
| `diagnose.bat` | 诊断开发环境 |

## 配置

### 端口配置

⚠️ **重要**: 修改 Vite 开发服务器端口时，必须同步更新以下文件：
1. `package.json` - `dev:electron` 脚本中的 wait-on URL
2. `vite.config.ts` - `server.port` 配置
3. `src/main/window.ts` - `VITE_DEV_PORT` 常量

**检查端口配置**：
```bash
npm run check-ports
```

详细说明请查看：[端口配置文档](./docs/PORT_CONFIGURATION.md)

### 当前端口
- **Vite 开发服务器**：5173（渲染进程开发）
- **Web 服务器**：8888（移动端连接）
- **传输服务器**：3001+（桌面端传输，自动递增）

### 配置文件
- 主进程配置：`src/main/config.ts`
- Web 端配置：`src/web/config.ts`
- 端口配置：`src/config/ports.ts`

### 修改固定 IP
编辑 `src/web/config.ts`：
```typescript
FIXED_IP: {
  HOST: '192.168.0.2',  // 修改为你的 IP
  PORT: 8888,
}
```

## 项目结构

```
├── src/
│   ├── main/       # Electron 主进程
│   ├── renderer/   # 桌面端渲染进程
│   ├── web/        # Web 端（移动端）
│   ├── shared/     # 共享组件
│   └── core/       # 核心业务逻辑
├── dist/           # 构建输出
├── release/        # 打包输出
├── dev.bat         # 开发启动脚本
└── start-quick.bat # 生产启动脚本
```

## 技术栈

- Electron 28
- React 18
- TypeScript 5
- Vite 5
- Socket.IO 4
- Tailwind CSS 3

## 功能特性

- ✅ 跨平台文件传输（Windows、Web、移动端）
- ✅ 局域网自动设备发现
- ✅ 实时传输进度显示
- ✅ 支持大文件传输
- ✅ 断点续传（开发中）
- ✅ 文本消息传输
- ✅ 历史记录管理

## 开发指南

### 修改代码后
- **渲染进程**（`src/renderer/`）：自动热重载
- **主进程**（`src/main/`）：需要重启 Electron
- **Web 端**（`src/web/`）：自动热重载

### 调试
- 渲染进程：开发模式自动打开 DevTools
- 主进程：查看启动 Electron 的终端日志
- Web 端：浏览器 DevTools

## 常见问题

### Q: 端口被占用？
A: 应用会自动尝试下一个可用端口

### Q: 修改主进程代码不生效？
A: 需要重启 Electron（Ctrl+C 然后 `npm run dev`）

### Q: 网页端显示空白？
A: 确保已运行 `npm run build` 构建 Web 端

## License

MIT
