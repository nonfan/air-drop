# 下载功能完整修复方案

## 问题根源分析

### 1. URL 解析和参数传递问题

**问题代码：**
```typescript
// handleRequest 中的路由逻辑
else if (url.startsWith('/download/')) {
  const parts = url.replace('/download/', '').split('/');
  if (parts.length === 2) {
    this.handleDownload(parts[0], parts[1], res); // parts[0]=clientId, parts[1]=fileId
  }
}
```

**实际 URL：** `http://192.168.1.5:8080/download/f6b70350-3e79-438b-9c96-3abaa6db16b5/c2b4gffk`

- `parts[0]` = `f6b70350-3e79-438b-9c96-3abaa6db16b5` (clientId)
- `parts[1]` = `c2b4gffk` (fileId)

**问题：** 当 `targetClientId` 与请求的 `clientId` 不匹配时，会返回 403 或在某些异常路径下返回 204。

### 2. 前端 URL 构建错误

**原始问题代码：**
```typescript
const isDev = import.meta.env.DEV;
const serverUrl = isDev ? 'http://localhost:80' : window.location.origin;
downloadUrl = `${serverUrl}${filePath}`;
```

**问题：**
1. 开发模式使用了错误的端口 `80`，实际应该是 `8080`
2. 生产模式使用 `window.location.origin` 会返回移动设备的地址，而不是 PC 端地址

### 3. 大文件内存溢出风险

**危险代码：**
```typescript
const chunks: Uint8Array[] = [];
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  chunks.push(value); // ⚠️ 4K 视频会导致内存溢出
}
const blob = new Blob(chunks); // 内存炸弹！
```

对于 2GB 的 4K 视频，这会导致浏览器崩溃。

## 完整修复方案

### 修复 1：后端 handleDownload 加固

**文件：** `src/main/services/webServer.ts`

```typescript
private handleDownload(clientId: string, fileId: string, res: http.ServerResponse) {
  console.log(`[Download] Request - clientId: ${clientId}, fileId: ${fileId}`);
  
  const info = this.sharedFiles.get(fileId);
  
  if (!info) {
    console.log(`[Download] File ID not found in sharedFiles map`);
    console.log(`[Download] Available fileIds:`, Array.from(this.sharedFiles.keys()));
    res.writeHead(404);
    return res.end('File index expired or not found');
  }
  
  console.log(`[Download] File info - path: ${info.filePath}, targetClientId: ${info.targetClientId}`);
  
  // 检查磁盘文件
  if (!fs.existsSync(info.filePath)) {
    console.log(`[Download] File does not exist on disk: ${info.filePath}`);
    res.writeHead(404);
    return res.end('File missing on disk');
  }
  
  // 权限检查：如果指定了目标客户端，只允许该客户端下载
  if (info.targetClientId !== null && info.targetClientId !== clientId) {
    console.log(`[Download] Access denied - targetClientId: ${info.targetClientId}, requestClientId: ${clientId}`);
    res.writeHead(403);
    return res.end('Access denied');
  }

  const stat = fs.statSync(info.filePath);
  const fileName = path.basename(info.filePath);
  
  console.log(`[Download] Serving file: ${fileName}, size: ${stat.size} bytes`);
  
  // ✅ 必须在写入数据前设置响应头
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': '*',
    // ✅ 必须暴露这些头，否则前端 fetch 拿不到
    'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition'
  });

  const readStream = fs.createReadStream(info.filePath);
  
  // ✅ 错误处理：防止流读取失败导致连接挂起
  readStream.on('error', (err) => {
    console.error('[Download] Stream error:', err);
    if (!res.headersSent) {
      res.writeHead(500);
    }
    res.end();
  });
  
  // ✅ 核心：泵入数据
  readStream.pipe(res);
  
  // ✅ 传输完成后的处理
  res.on('finish', () => {
    console.log(`[Download] Finished sending: ${fileName}`);
    this.emit('file-downloaded', { id: fileId, name: fileName, size: stat.size, clientId });
    
    // 延迟删除文件 ID，允许重复下载
    setTimeout(() => {
      if (this.sharedFiles.has(fileId)) {
        this.sharedFiles.delete(fileId);
        console.log(`[Download] Removed fileId from sharedFiles: ${fileId}`);
      }
    }, 60000);
  });
}
```

**关键改进：**
1. ✅ 增加详细的调试日志
2. ✅ 使用 `return res.end()` 确保错误路径正确结束
3. ✅ 添加流错误处理
4. ✅ 使用 `res.on('finish')` 而不是 `readStream.on('end')`
5. ✅ 确保 `Access-Control-Expose-Headers` 正确设置

### 修复 2：前端使用浏览器原生下载

**文件：** `src/web/App.tsx`

```typescript
const handleDownloadFile = useCallback(async (filePath: string, fileName: string, itemId: string) => {
  if (downloadedIds.has(itemId)) {
    return;
  }

  setDownloadingId(itemId);

  try {
    console.log('[Download] Starting download:', fileName, filePath);

    // 构建完整的下载 URL
    let downloadUrl = filePath;
    if (filePath.startsWith('/')) {
      // ✅ 在生产模式下，window.location.origin 就是 PC 的地址（如 http://192.168.1.5:8080）
      // ✅ 在开发模式下，使用 localhost:8080
      const isDev = import.meta.env?.DEV;
      const serverUrl = isDev ? 'http://localhost:8080' : window.location.origin;
      downloadUrl = `${serverUrl}${filePath}`;
    }

    console.log('[Download] Download URL:', downloadUrl);

    // ✅ 直接使用浏览器原生下载，避免内存溢出
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // 清理
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);

    console.log('[Download] Download triggered successfully');

    setDownloadingId(null);

    // 标记为已下载
    const newDownloadedIds = new Set(downloadedIds).add(itemId);
    setDownloadedIds(newDownloadedIds);
    localStorage.setItem('windrop-downloaded-ids', JSON.stringify(Array.from(newDownloadedIds)));

  } catch (error) {
    console.error('[Download] Download error:', error);
    setDownloadingId(null);
    setDownloadFailedId(itemId);
    
    const newFailedIds = new Set(downloadFailedIds).add(itemId);
    setDownloadFailedIds(newFailedIds);
    localStorage.setItem('windrop-download-failed-ids', JSON.stringify(Array.from(newFailedIds)));

    if (socket && socket.connected) {
      socket.emit('download-failed', { fileName, filePath });
    }
  }
}, [downloadedIds, downloadFailedIds, socket]);
```

**关键改进：**
1. ✅ 移除了 `fetch` + `chunks.push` 的内存溢出风险
2. ✅ 使用浏览器原生下载引擎
3. ✅ 自动处理大文件，不占用网页内存
4. ✅ 浏览器自带下载进度条
5. ✅ 修复了开发模式端口错误（从 80 改为 8080）
6. ✅ 生产模式下 `window.location.origin` 是正确的（移动端通过 PC IP 访问）

### 修复 3：移除不必要的进度跟踪状态

由于改用浏览器原生下载，可以移除以下状态（可选优化）：

```typescript
// 这些状态现在不再需要
const [downloadProgressMap, setDownloadProgressMap] = useState<Map<string, DownloadProgress>>(new Map());
```

## 为什么会出现 HTTP 204？

1. **响应头未正确设置**：如果在某些异常路径下调用了 `res.writeHead()` 但没有写入 Body 就 `res.end()`
2. **流错误未处理**：`readStream` 出错但没有正确处理，导致连接提前关闭
3. **权限检查失败**：`targetClientId` 不匹配时返回 403，但某些情况下可能被浏览器解析为 204

## 测试验证步骤

### 1. 检查 clientId 匹配
```typescript
// 在浏览器控制台查看
console.log('Socket connected:', socket?.connected);
console.log('Socket ID:', socket?.id);
console.log('Download URL:', downloadUrl);
```

### 2. 检查后端日志
```
[Download] Request - clientId: xxx, fileId: xxx
[Download] File info - path: xxx, targetClientId: xxx
[Download] Serving file: xxx, size: xxx bytes
[Download] Finished sending: xxx
```

### 3. 测试不同文件大小
- ✅ 小文件（< 10MB）：验证基本功能
- ✅ 中等文件（10-100MB）：验证稳定性
- ✅ 大文件（> 100MB）：验证不会内存溢出
- ✅ 4K 视频（> 1GB）：验证浏览器原生下载

## 优势总结

### 使用浏览器原生下载的优势

1. **零内存占用**：不在网页内存中缓存文件
2. **断点续传**：浏览器自动支持
3. **原生进度条**：系统级下载管理
4. **稳定可靠**：经过充分测试的下载引擎
5. **支持超大文件**：没有大小限制

### 缺点

- 无法在自定义 UI 中显示进度条
- 无法在下载前预览文件

### 如果需要自定义进度条

可以使用 [StreamSaver.js](https://github.com/jimmywarting/StreamSaver.js)：

```typescript
import streamSaver from 'streamsaver';

const fileStream = streamSaver.createWriteStream(fileName, { size: totalSize });
const writer = fileStream.getWriter();

const response = await fetch(downloadUrl);
const reader = response.body.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  await writer.write(value); // 直接写入磁盘
  receivedSize += value.length;
  
  // 更新自定义进度条
  setProgress(receivedSize / totalSize);
}

await writer.close();
```

## 修改文件清单

- ✅ `src/main/services/webServer.ts` - 加固 handleDownload 方法
- ✅ `src/web/App.tsx` - 改用浏览器原生下载
- ✅ `DOWNLOAD_URL_FIX.md` - 更新文档
