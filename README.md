# WinDrop

Windows 版 AirDrop - 局域网文件快速传输工具

## 功能特性

- 🔍 自动发现局域网内的其他 WinDrop 设备 (mDNS/Bonjour)
- 📁 支持多文件选择和拖拽上传
- 📊 实时传输进度显示
- 🔔 接收文件时弹窗确认 + 系统通知
- ⚙️ 可配置设备名称、下载路径、自动接受等
- 🎨 现代化毛玻璃 UI 设计
- 📌 系统托盘常驻

## 技术栈

- Electron 28
- React 18 + TypeScript
- Tailwind CSS
- mDNS (Bonjour) 设备发现
- WebSocket 文件流式传输

## 开发

```bash
# 安装依赖
npm install

# 开发模式 (需要两个终端)
# 终端1: 启动 Vite
npm run dev:renderer

# 终端2: 启动 Electron
npm run dev:main

# 或者使用 concurrently
npm run dev

# 构建
npm run build

# 打包成安装程序
npm run dist
```

## 使用方法

1. 在两台 Windows 电脑上运行 WinDrop
2. 确保两台电脑在同一局域网
3. 等待设备自动发现（几秒钟内）
4. 点击选择目标设备
5. 拖拽文件或点击"选择文件"
6. 点击"发送"，对方确认后开始传输
7. 可在设置中配置下载路径、自动接受等

## 设置选项

- **设备名称**: 显示给其他设备的名称
- **下载位置**: 接收文件的保存路径
- **自动接受**: 自动接受所有传入文件（不推荐在公共网络使用）
- **显示通知**: 收到文件时显示系统通知

## 注意事项

- 首次运行需要允许 Windows 防火墙访问
- 确保两台设备在同一网段（同一路由器下）
- 大文件传输速度取决于局域网带宽
- 支持同时传输多个文件

## 与 Apple AirDrop 的区别

WinDrop 使用标准的 mDNS + WebSocket 协议，无法直接与 Apple 设备互通。
Apple AirDrop 使用专有的 AWDL (Apple Wireless Direct Link) 协议。

如需与 Apple 设备传输文件，建议使用：
- LocalSend (开源跨平台)
- Snapdrop (网页版)
- 共享文件夹
