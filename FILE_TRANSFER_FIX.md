# 文件传输修复和下载进度条功能

## 修复的问题

### 1. 图片 404 问题
- **问题**: 网页端图片使用绝对路径 `/icon.png`，在 Electron 的 `file://` 协议下导致 404
- **解决方案**:
  - 移除 HTML 中的静态图片引用
  - 在 `main.tsx` 中通过 `import` 动态导入图片并设置 favicon
  - 在 `App.tsx` 中导入图片用于通知图标
  - 创建 `assets.d.ts` 类型声明文件支持图片导入
  - 由于使用 `vite-plugin-singlefile`，所有资源都被内联为 base64

### 2. 文件传输无法工作
- **问题**: Web 端使用 HTTP POST 上传到 `/api/upload`，但服务器没有处理这个路由
- **解决方案**:
  - 在 `webServer.ts` 的 `handleRequest` 方法中添加 `/api/upload` 路由处理
  - 实现 `handleUpload` 方法来处理 multipart/form-data 文件上传
  - 解析表单数据提取文件名、目标设备 ID 和文件内容
  - 保存文件到下载目录
  - 如果目标是其他设备，通过 WebSocket 通知目标设备
  - 通过 WebSocket 发送上传完成消息

## 新增功能

### 下载进度条
在网页端接收文件时，在传输记录底部显示下载进度条：

#### 1. 状态管理 (App.tsx)
```typescript
const [downloadProgress, setDownloadProgress] = useState<TransferProgress | null>(null);
```

#### 2. 下载进度跟踪
修改 `handleDownloadFile` 函数使用 Fetch API 的 Stream 读取器：
- 获取响应的 content-length
- 使用 ReadableStream reader 逐块读取数据
- 实时更新下载进度百分比
- 完成后创建 Blob 并触发下载

#### 3. WebSocket 消息处理
添加 `download-progress` 消息类型处理：
```typescript
else if (data.type === 'download-progress') {
  setDownloadProgress({
    percent: data.percent,
    currentFile: data.fileName,
    totalSize: data.totalSize,
    sentSize: data.receivedSize
  });
}
```

#### 4. UI 组件 (TransferPage.tsx)
在右侧传输记录底部添加固定的下载进度条：
- 显示文件名和下载图标（带动画）
- 显示已下载大小 / 总大小
- 显示百分比
- 进度条动画效果

## 文件修改清单

### 修改的文件
1. `src/web/index.html` - 移除静态图片引用
2. `src/web/main.tsx` - 动态设置 favicon
3. `src/web/App.tsx` - 添加下载进度状态和处理逻辑
4. `src/web/components/TransferPage.tsx` - 添加下载进度条 UI
5. `src/main/services/webServer.ts` - 添加文件上传处理

### 新增的文件
1. `src/web/assets.d.ts` - 图片模块类型声明

## 技术要点

### 1. Vite 资源处理
- 使用 `import` 导入图片，Vite 会自动处理并转换为 base64（配合 vite-plugin-singlefile）
- 所有资源内联到单个 HTML 文件中，无需额外的静态文件服务

### 2. Multipart/Form-Data 解析
- 手动解析 multipart/form-data 格式
- 提取 boundary 分隔符
- 解析表单字段（fileName, targetId）
- 提取二进制文件数据

### 3. 流式下载
- 使用 Fetch API 的 ReadableStream
- 逐块读取数据并更新进度
- 避免一次性加载大文件到内存

### 4. 进度条动画
- 使用 CSS transition 实现平滑动画
- 下载图标使用 animate-pulse 类添加脉冲效果
- 固定在底部，不影响滚动区域

## 测试建议

1. **文件上传测试**:
   - 从网页端选择文件上传到桌面端
   - 从网页端上传文件到另一个移动设备
   - 测试多个文件连续上传

2. **下载进度测试**:
   - 下载小文件（< 1MB）- 验证进度条快速完成
   - 下载大文件（> 10MB）- 验证进度条平滑更新
   - 下载过程中刷新页面 - 验证状态重置

3. **图片显示测试**:
   - 检查浏览器控制台无 404 错误
   - 验证 favicon 正确显示
   - 验证通知图标正确显示（如果启用通知）

## 已知限制

1. multipart/form-data 解析是简化版本，可能不支持所有边缘情况
2. 下载进度依赖 content-length 头，某些服务器可能不提供
3. 大文件下载时内存占用较高（需要将所有块保存在内存中）

## 未来改进建议

1. 使用成熟的 multipart 解析库（如 busboy）
2. 实现分块下载和断点续传
3. 添加上传进度条（与下载进度条对称）
4. 优化大文件处理，使用流式写入而非内存缓存
