# iOS 下载问题修复方案

## 问题描述

在 iOS Safari 和 PWA 应用中，使用传统的 `<a>` 标签下载文件时会出现以下问题：

1. **页面跳转**：点击下载后会跳转到文件预览页面
2. **无法返回**：用户无法返回到原来的 PWA 应用
3. **体验中断**：打断了应用的使用流程

## 根本原因

iOS Safari 对文件下载的处理方式与其他浏览器不同：

- **传统方式**：`<a href="file.pdf" download>` 会导致页面跳转
- **iOS 行为**：Safari 会在新页面中打开文件预览
- **PWA 限制**：PWA 应用无法控制这个跳转行为

## 解决方案

### 方案 1：Fetch + Blob（推荐）✅

使用 Fetch API 下载文件为 Blob，然后创建 Blob URL 触发下载。

**优点：**
- 不会导致页面跳转
- 保持在 PWA 应用内
- 支持大文件下载
- 可以显示下载进度

**实现：**

```typescript
// 检测 iOS 设备
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

if (isIOS) {
  // 使用 Fetch + Blob 方式
  const response = await fetch(downloadUrl);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = fileName;
  link.click();
  
  // 清理
  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
  }, 100);
}
```

### 方案 2：Share API（备选）

使用 Web Share API 分享文件，让用户选择保存位置。

**优点：**
- 原生体验
- 不会跳转
- 支持分享到其他应用

**缺点：**
- 需要用户交互
- 不是直接下载

**实现：**

```typescript
if (navigator.share && navigator.canShare) {
  const response = await fetch(downloadUrl);
  const blob = await response.blob();
  const file = new File([blob], fileName, { type: blob.type });
  
  await navigator.share({
    files: [file],
    title: fileName
  });
}
```

### 方案 3：Service Worker（高级）

使用 Service Worker 拦截下载请求，返回 Blob 响应。

**优点：**
- 完全控制下载流程
- 支持离线下载
- 可以添加自定义逻辑

**缺点：**
- 实现复杂
- 需要注册 Service Worker

## 实现细节

### 1. iOS 检测

```typescript
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
```

### 2. Fetch 下载

```typescript
const response = await fetch(downloadUrl);
if (!response.ok) {
  throw new Error(`HTTP error! status: ${response.status}`);
}

const blob = await response.blob();
```

### 3. 创建 Blob URL

```typescript
const blobUrl = URL.createObjectURL(blob);
```

### 4. 触发下载

```typescript
const link = document.createElement('a');
link.href = blobUrl;
link.download = fileName;
link.style.display = 'none';
document.body.appendChild(link);
link.click();
```

### 5. 清理资源

```typescript
setTimeout(() => {
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}, 100);
```

## 完整实现

已在 `src/web/hooks/useDownload.ts` 中实现：

```typescript
const downloadFile = useCallback(async (filePath: string, fileName: string, itemId: string) => {
  // ... 状态管理代码 ...

  try {
    // 构建下载 URL
    let downloadUrl = filePath;
    if (filePath.startsWith('/')) {
      const isDev = import.meta.env?.DEV;
      const serverUrl = isDev ? 'http://localhost:8080' : window.location.origin;
      downloadUrl = `${serverUrl}${filePath}`;
    }

    // 检测 iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // iOS 使用 Fetch + Blob
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 100);
      
    } else {
      // 非 iOS 使用传统方式
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
      }, 100);
    }

    setDownloadingId(null);

  } catch (error) {
    // ... 错误处理 ...
  }
}, [/* dependencies */]);
```

## 测试建议

### 1. iOS Safari 测试

- 打开 Safari 浏览器
- 访问应用 URL
- 测试下载各种类型的文件
- 验证不会跳转到新页面

### 2. iOS PWA 测试

- 添加应用到主屏幕
- 从主屏幕打开应用
- 测试下载功能
- 验证保持在应用内

### 3. 不同文件类型测试

- 图片文件（.jpg, .png）
- 文档文件（.pdf, .docx）
- 压缩文件（.zip, .rar）
- 视频文件（.mp4, .mov）

### 4. 大文件测试

- 测试 10MB+ 文件
- 验证下载进度
- 验证内存使用

## 注意事项

### 1. 内存限制

iOS Safari 对 Blob 大小有限制（通常 < 500MB）：

```typescript
// 对于大文件，可以考虑分块下载
if (fileSize > 100 * 1024 * 1024) { // 100MB
  // 使用传统方式或提示用户
  console.warn('Large file, may cause memory issues');
}
```

### 2. CORS 问题

确保服务器设置了正确的 CORS 头：

```typescript
// 服务器端
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Disposition');
```

### 3. Content-Type

确保服务器返回正确的 Content-Type：

```typescript
// 服务器端
const contentTypes = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.zip': 'application/zip'
};
```

### 4. 文件名编码

处理特殊字符的文件名：

```typescript
const encodedFileName = encodeURIComponent(fileName);
link.download = encodedFileName;
```

## 性能优化

### 1. 下载进度

显示下载进度提升用户体验：

```typescript
const response = await fetch(downloadUrl);
const reader = response.body.getReader();
const contentLength = +response.headers.get('Content-Length');

let receivedLength = 0;
const chunks = [];

while(true) {
  const {done, value} = await reader.read();
  
  if (done) break;
  
  chunks.push(value);
  receivedLength += value.length;
  
  // 更新进度
  const percent = Math.round((receivedLength / contentLength) * 100);
  updateProgress(percent);
}

const blob = new Blob(chunks);
```

### 2. 取消下载

支持取消下载：

```typescript
const controller = new AbortController();

const response = await fetch(downloadUrl, {
  signal: controller.signal
});

// 取消下载
controller.abort();
```

### 3. 缓存策略

使用 Cache API 缓存已下载的文件：

```typescript
const cache = await caches.open('downloads');
const cachedResponse = await cache.match(downloadUrl);

if (cachedResponse) {
  const blob = await cachedResponse.blob();
  // 使用缓存的文件
} else {
  // 下载并缓存
  const response = await fetch(downloadUrl);
  await cache.put(downloadUrl, response.clone());
  const blob = await response.blob();
}
```

## 替代方案

### 1. 使用 FileSaver.js

第三方库提供更好的兼容性：

```bash
npm install file-saver
```

```typescript
import { saveAs } from 'file-saver';

const response = await fetch(downloadUrl);
const blob = await response.blob();
saveAs(blob, fileName);
```

### 2. 使用 StreamSaver.js

支持大文件流式下载：

```bash
npm install streamsaver
```

```typescript
import streamSaver from 'streamsaver';

const fileStream = streamSaver.createWriteStream(fileName);
const response = await fetch(downloadUrl);
response.body.pipeTo(fileStream);
```

## 总结

通过使用 Fetch + Blob 的方式，我们成功解决了 iOS Safari 和 PWA 应用中的下载跳转问题。这个方案：

✅ 避免页面跳转
✅ 保持在 PWA 应用内
✅ 支持各种文件类型
✅ 提供良好的用户体验
✅ 兼容其他浏览器

## 相关文件

- `src/web/hooks/useDownload.ts` - 下载逻辑实现
- `src/shared/components/HistoryItem.tsx` - 下载按钮组件
- `src/main/services/webServer.ts` - 服务器端文件服务

## 参考资料

- [MDN - Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [MDN - Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob)
- [MDN - URL.createObjectURL()](https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL)
- [iOS Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/Introduction/Introduction.html)
