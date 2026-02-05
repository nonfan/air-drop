# 下载进度卡片说明文档

## 问题

在 `src/renderer/App.tsx` 中有这段代码：

```tsx
{/* 下载进度卡片 */}
{isDownloading && receiveProgress && (
  <DownloadProgressCard
    fileName={receiveProgress.currentFile || '未知文件'}
    fileSize={receiveProgress.totalSize}
    progress={receiveProgress.percent}
    receivedSize={receiveProgress.sentSize}
  />
)}
```

**这个下载进度卡片是桌面端的吗？**

## 答案

**是的，这是桌面端（Electron 渲染进程）的下载进度卡片。**

但它显示的是**桌面端接收文件的进度**，包括：
1. 从其他桌面端接收文件
2. 从移动端接收文件（上传到桌面端）

## 详细说明

### 文件位置

- **组件定义**: `src/renderer/components/DownloadProgressCard.tsx`
- **使用位置**: `src/renderer/App.tsx`（桌面端渲染进程）

### receiveProgress 的来源

`receiveProgress` 状态在桌面端有**三个数据源**：

#### 1. 桌面端之间的文件传输
```typescript
window.windrop.onTransferProgress((progress) => {
  setReceiveProgress(progress);
  setIsDownloading(true);
});
```
**场景**: 桌面端 A → 桌面端 B  
**显示**: 桌面端 B 接收文件的进度

#### 2. 移动端上传到桌面端（旧事件）
```typescript
window.windrop.onWebUploadProgress((progress) => {
  // 移动端上传到桌面端的进度
  setReceiveProgress({
    percent: progress.percent,
    currentFile: progress.name,
    totalSize: 0,
    sentSize: 0
  });
  setIsDownloading(true);
});
```
**场景**: 移动端 → 桌面端  
**显示**: 桌面端接收文件的进度

#### 3. 移动端上传到桌面端（新事件）
```typescript
window.windrop.onMobileUploadProgress((progress) => {
  // 移动端上传进度（显示为桌面端的接收进度）
  console.log(`[Desktop] Mobile upload progress: ${progress.fileName} ${progress.percent}%`);
  setReceiveProgress({
    percent: progress.percent,
    currentFile: progress.fileName,
    totalSize: progress.totalSize,
    sentSize: progress.sentSize
  });
  setIsDownloading(true);
});
```
**场景**: 移动端 → 桌面端  
**显示**: 桌面端接收文件的进度（更完整的数据）

### 进度完成事件

```typescript
// 桌面端之间传输完成
window.windrop.onTransferComplete(() => {
  setReceiveProgress(null);
  setIsDownloading(false);
});

// 移动端上传完成
window.windrop.onWebUploadComplete(() => {
  setReceiveProgress(null);
  setIsDownloading(false);
});
```

## 进度卡片的作用

### 显示内容
- 文件名
- 文件大小
- 下载进度百分比
- 已接收大小

### 显示位置
固定在桌面端窗口底部（`fixed bottom-0`）

### 显示时机
- `isDownloading = true` 且 `receiveProgress` 有值时显示
- 传输完成后自动隐藏

## 与移动端的区别

### 桌面端（当前讨论的）
```tsx
// src/renderer/App.tsx
{isDownloading && receiveProgress && (
  <DownloadProgressCard
    fileName={receiveProgress.currentFile || '未知文件'}
    fileSize={receiveProgress.totalSize}
    progress={receiveProgress.percent}
    receivedSize={receiveProgress.sentSize}
  />
)}
```
**用途**: 显示桌面端**接收**文件的进度

### 移动端
移动端没有使用 `DownloadProgressCard` 组件，而是使用其他方式显示进度。

## 命名混淆问题

### 问题
组件名叫 `DownloadProgressCard`（下载进度），但实际显示的是**接收进度**（receive progress）。

### 原因
- "下载"和"接收"在用户角度是同一个概念
- 从桌面端的视角看，接收文件 = 下载文件

### 建议
为了更清晰，可以考虑重命名：
- `DownloadProgressCard` → `ReceiveProgressCard`
- 或保持现状，因为用户理解"下载"更直观

## 数据流图

### 桌面端接收文件（从其他桌面端）
```
发送端桌面 → HTTP 传输 → 接收端桌面
                           ↓
                    onTransferProgress
                           ↓
                    setReceiveProgress
                           ↓
                  DownloadProgressCard 显示
```

### 桌面端接收文件（从移动端）
```
移动端 → Socket.IO 上传 → 桌面端
                          ↓
                  onMobileUploadProgress
                          ↓
                   setReceiveProgress
                          ↓
                 DownloadProgressCard 显示
```

## 代码优化建议

### 1. 统一事件处理

当前有两个移动端上传事件：
- `onWebUploadProgress`（旧）
- `onMobileUploadProgress`（新）

**建议**: 统一使用 `onMobileUploadProgress`，删除旧事件。

### 2. 改进数据结构

```typescript
// 当前
setReceiveProgress({
  percent: progress.percent,
  currentFile: progress.name,
  totalSize: 0,  // ❌ 缺少数据
  sentSize: 0    // ❌ 缺少数据
});

// 建议
setReceiveProgress({
  percent: progress.percent,
  currentFile: progress.fileName,
  totalSize: progress.totalSize,  // ✅ 完整数据
  sentSize: progress.sentSize     // ✅ 完整数据
});
```

### 3. 添加来源标识

```typescript
interface TransferProgress {
  percent: number;
  currentFile: string;
  totalSize: number;
  sentSize: number;
  source?: 'desktop' | 'mobile';  // 新增：标识来源
}
```

### 4. 改进进度卡片

```tsx
<DownloadProgressCard
  fileName={receiveProgress.currentFile || '未知文件'}
  fileSize={receiveProgress.totalSize}
  progress={receiveProgress.percent}
  receivedSize={receiveProgress.sentSize}
  source={receiveProgress.source}  // 显示来源
/>
```

## 测试场景

### 场景 1: 桌面端接收文件（从其他桌面端）
1. 桌面端 A 选择文件
2. 发送到桌面端 B
3. 桌面端 B 应显示 `DownloadProgressCard`
4. 显示文件名、大小、进度

### 场景 2: 桌面端接收文件（从移动端）
1. 移动端选择文件
2. 上传到桌面端
3. 桌面端应显示 `DownloadProgressCard`
4. 显示文件名、大小、进度

### 场景 3: 进度卡片消失
1. 文件传输完成
2. `DownloadProgressCard` 应自动隐藏
3. 文件出现在历史记录中

## 总结

### 核心要点

1. **位置**: `DownloadProgressCard` 在桌面端（`src/renderer/App.tsx`）
2. **用途**: 显示桌面端**接收**文件的进度
3. **来源**: 可以接收来自桌面端或移动端的文件
4. **显示**: 固定在窗口底部，传输时显示，完成后隐藏

### 命名说明

虽然叫"下载进度"，但实际是"接收进度"。从用户角度看，接收文件就是下载文件，所以命名是合理的。

### 优化方向

1. 统一移动端上传事件
2. 完善进度数据结构
3. 添加来源标识
4. 改进用户体验

## 相关文件

- `src/renderer/App.tsx` - 使用进度卡片
- `src/renderer/components/DownloadProgressCard.tsx` - 进度卡片组件
- `src/main/ipc/handlers.ts` - IPC 事件定义
- `src/main/services/webServer.ts` - 移动端上传处理
