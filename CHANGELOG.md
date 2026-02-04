# 更新日志

## v1.8.0 (2025-02-04)

### 🎉 新特性
- 统一端口配置管理系统
- 创建 `src/main/config.ts` 和 `src/web/config.ts` 配置文件
- 所有端口配置集中管理，便于维护

### 🐛 Bug 修复
- 修复桌面端启动时找不到 `dist/main/main.js` 的问题
- 修复端口 3001 权限被拒绝错误（改为绑定 127.0.0.1）
- 修复 `indexedDB is not defined` 错误
- 修复渲染进程文件路径错误
- 修复网页端 "Template not found" 错误
- 修复 Logo 显示问题（使用内联样式）
- 修复 NODE_ENV 环境变量设置问题

### 🔧 优化改进
- 简化 npm 命令，从 25 个减少到 9 个核心命令
- 创建 `dev.bat` 和 `start-quick.bat` 便捷启动脚本
- 移除二维码弹窗的 iOS 提示
- 禁用代码签名，避免 Windows 符号链接权限问题
- 删除所有测试和诊断脚本，精简项目结构

### 📝 配置变更
- Web 服务器端口：8080 → 8888
- 传输服务器端口：3001（绑定到 127.0.0.1）
- 开发服务器端口：5173

### 🗑️ 清理
- 删除 30+ 个文档文件
- 删除测试文件和脚本（test-e2e.js, test-transfer.js, verify-transfer.js 等）
- 删除诊断脚本（diagnose.js）
- 删除无用的配置文件（.env.production, build.bat）

---

## v1.7.0 (2024-12-XX)

### 功能
- 初始版本发布
- 支持跨平台文件传输
- 桌面端和移动端支持
