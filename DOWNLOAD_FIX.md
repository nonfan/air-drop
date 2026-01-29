# 文件下载功能修复

## 问题描述

网页端点击下载文件时，浏览器显示"无法从网站上提取文件"错误，下载失败。

## 原因分析

1. **简单的 `<a>` 标签下载被浏览器阻止**
   - 移动浏览器对跨域下载有严格限制
   - HTTP 下载在某些浏览器中被视为不安全

2. **缺少下载进度反馈**
   - 用户不知道下载是否在进行中
   - 大文件下载时没有进度提示

## 解决方案

使用 `fetch` API 下载文件，支持：
- ✅ 下载进度跟踪
- ✅ 更好的错误处理
- ✅ 支持大文件下载
- ✅ 兼容所有现代浏览器

### 实现细节

```typescript
// 1. 使用 fetch 获取文件
const response = await fetch(filePath);

// 2. 获取文件大小
const contentLength = response.headers.get('content-length');
const totalSize = parseInt(contentLength, 10);

// 3. 读取数据流并跟踪进度
const reader = response.body.getReader();
const chunks = [];
let receivedSize = 0;

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  chunks.push(value);
  receivedSize += value.length;
  
  // 更新进度
  const percent = Math.round((receivedSize / totalSize) * 100);
  setDownloadProgressMap(prev => {
    const newMap = new Map(prev);
    newMap.set(itemId, { percent, receivedSize, totalSize });
    return newMap;
  });
}

// 4. 创建 Blob 并触发下载
const blob = new Blob(chunks);
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = fileName;
link.click();

// 5. 清理资源
URL.revokeObjectURL(url);
```

## 测试步骤

### 1. 刷新网页

如果使用开发模式：
- 浏览器访问：`http://localhost:5174/`
- 按 `Ctrl+Shift+R` 强制刷新

如果使用生产模式：
- 手机浏览器访问：`http://192.168.1.5:80`
- 刷新页面

### 2. 发送文件

从桌面端发送一个文件到网页端：
1. 在桌面端选择文件
2. 选择目标设备（网页端）
3. 点击发送

### 3. 下载文件

在网页端：
1. 查看传输历史
2. 找到刚收到的文件
3. 点击"下载"按钮

### 4. 观察下载过程

**预期行为：**
- ✅ 点击下载后，按钮显示"下载中"
- ✅ 如果文件较大，可以看到下载进度（百分比）
- ✅ 下载完成后，浏览器自动保存文件
- ✅ 按钮变为"已下载"状态
- ✅ 不再显示"无法从网站上提取文件"错误

## 新增功能

### 1. 下载进度显示

```typescript
// 在 HistoryList 组件中显示下载进度
{downloadProgressMap.has(item.id) && (
  <div className="text-xs text-muted">
    下载中: {downloadProgressMap.get(item.id)?.percent}%
  </div>
)}
```

### 2. 下载状态持久化

- 已下载的文件 ID 保存到 `localStorage`
- 刷新页面后仍然显示"已下载"状态
- 下载失败的文件 ID 也会保存，显示"下载失败"

### 3. 重试机制

- 下载失败的文件可以重新点击下载
- 点击后会清除失败状态并重新尝试

## 常见问题

### Q1: 下载速度慢

**原因：** 使用 fetch API 下载会先将整个文件加载到内存，然后再保存。

**解决方案：** 
- 对于小文件（< 100MB），这不是问题
- 对于大文件，可以考虑使用 Service Worker 或 StreamSaver.js

### Q2: 下载后文件名不对

**原因：** 浏览器可能会修改文件名。

**解决方案：** 
- 已在代码中设置 `link.download = fileName`
- 大多数浏览器会尊重这个设置

### Q3: 移动浏览器下载到哪里了？

**答案：** 
- iOS Safari：下载到"文件"应用的"下载"文件夹
- Android Chrome：下载到"下载"文件夹
- 可以在浏览器的下载管理器中查看

### Q4: 仍然显示 HTTPS 警告

**答案：** 
- 这是浏览器的标准警告，不影响功能
- 在局域网环境中使用 HTTP 是安全的
- 如果需要消除警告，可以添加 HTTPS 支持（需要自签名证书）

## 性能优化

### 内存使用

当前实现会将整个文件加载到内存中：
- 小文件（< 10MB）：无影响
- 中等文件（10-100MB）：可接受
- 大文件（> 100MB）：可能导致内存压力

**优化建议：**
- 对于大文件，可以使用 Service Worker 实现真正的流式下载
- 或者直接使用服务器的下载链接（不经过 JavaScript）

### 网络优化

- 使用 HTTP/2 可以提高下载速度
- 启用 gzip 压缩可以减少传输大小
- 考虑添加断点续传支持

## 下一步

如果下载功能仍然有问题，请提供：

1. **浏览器控制台日志**
   - 按 F12 打开开发者工具
   - 切换到 Console 标签页
   - 复制所有错误信息

2. **网络请求详情**
   - 在开发者工具中切换到 Network 标签页
   - 点击下载按钮
   - 查看下载请求的状态码和响应

3. **文件信息**
   - 文件大小
   - 文件类型
   - 下载链接（URL）

---

## 技术细节

### Fetch API vs XMLHttpRequest

**Fetch API 优势：**
- ✅ 更现代的 API
- ✅ 支持 Promise
- ✅ 更好的流式处理
- ✅ 更简洁的代码

**XMLHttpRequest 优势：**
- ✅ 更好的进度事件
- ✅ 更广泛的浏览器支持
- ✅ 可以中止请求

### Blob vs ArrayBuffer

**使用 Blob 的原因：**
- ✅ 可以直接创建下载链接
- ✅ 内存效率更高
- ✅ 支持大文件

### URL.createObjectURL vs Data URL

**使用 createObjectURL 的原因：**
- ✅ 不需要 base64 编码
- ✅ 内存效率更高
- ✅ 支持大文件
- ⚠️ 需要手动释放（revokeObjectURL）

---

## 总结

✅ 已修复文件下载功能
✅ 添加下载进度显示
✅ 支持下载状态持久化
✅ 支持下载失败重试

现在请刷新网页并测试下载功能！
