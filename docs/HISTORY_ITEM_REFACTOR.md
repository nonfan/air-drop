# HistoryItem 组件重构文档

## 重构日期
2026-02-05

## 重构目标

1. 修复 `src/renderer/App.tsx` 中的 TypeScript 错误
2. 重构 `HistoryItem` 组件，支持底部展示进度条
3. 改进接收文件时的进度显示体验

## 已完成的修改

### 1. App.tsx 修复

#### 问题 1: 缺少可选事件的类型检查
```typescript
// ❌ 错误：事件可能不存在
window.windrop.onMobileDownloadProgress((progress) => { ... });
window.windrop.onMobileUploadProgress((progress) => { ... });
```

**修复**:
```typescript
// ✅ 正确：添加类型检查
if (window.windrop.onMobileDownloadProgress) {
  window.windrop.onMobileUploadProgress((progress: any) => { ... });
}

if (window.windrop.onMobileUploadProgress) {
  window.windrop.onMobileUploadProgress((progress: any) => { ... });
}
```

#### 问题 2: DownloadProgressCard 的 fileSize 可能为 undefined
```typescript
// ❌ 错误：totalSize 可能为 undefined
{isDownloading && receiveProgress && (
  <DownloadProgressCard fileSize={receiveProgress.totalSize} />
)}
```

**修复**:
```typescript
// ✅ 正确：添加空值检查
{isDownloading && receiveProgress && receiveProgress.totalSize && receiveProgress.totalSize > 0 && (
  <DownloadProgressCard fileSize={receiveProgress.totalSize} />
)}
```

#### 问题 3: 导入路径错误
```typescript
// ❌ 错误：直接从文件导入
import type { HistoryItemType } from '../../shared/components/HistoryItem';
```

**修复**:
```typescript
// ✅ 正确：从 index 导入
import type { HistoryItemType } from '../../shared/components';
```

### 2. HistoryItem 组件重构

#### 新增状态类型
```typescript
export interface HistoryItemType {
  // ... 其他字段
  status: 'success' | 'failed' | 'pending' | 'downloading';  // 新增 downloading
  progress?: number;  // 新增：当前进度百分比（0-100）
}
```

#### 改进进度条显示逻辑

**之前**：进度条在卡片内部，与内容混在一起
```typescript
{/* 下载进度条 - 放在卡片底部 */}
{item.type === 'file' && isDownloading && currentDownloadProgress > 0 && !compact && (
  <div className="mt-auto pt-2">
    {/* 进度条 */}
  </div>
)}
```

**现在**：进度条独立在卡片外部底部
```typescript
{/* 进度条 - 独立放在卡片外部底部 */}
{showProgress && (
  <div className="mt-2 px-3 pb-2">
    {/* 进度条 */}
  </div>
)}
```

#### 新增进度显示逻辑
```typescript
// 获取当前下载进度（优先级：item.progress > downloadProgress > downloadProgressMap）
const progressFromMap = downloadProgressMap.get(item.id);
const progressFromProp = downloadProgress?.[item.id];
const progressFromItem = item.progress;
const currentDownloadProgress = progressFromItem || progressFromProp || progressFromMap?.percent || 0;

// 判断是否显示进度条
const showProgress = item.type === 'file' && 
                     isDownloading && 
                     currentDownloadProgress > 0 && 
                     currentDownloadProgress < 100 &&
                     !compact;
```

#### 改进进度条 UI

**新增功能**：
1. **加载动画**：旋转的圆圈图标
2. **渐变进度条**：从 accent 到 accent/80 的渐变
3. **数字格式化**：使用 `tabular-nums` 保持数字对齐
4. **文件大小显示**：显示已接收/总大小

```typescript
<div className="mt-2 px-3 pb-2">
  {/* 进度信息 */}
  <div className="flex items-center justify-between text-xs text-muted mb-1.5">
    <span className="flex items-center gap-1.5">
      {/* 旋转加载图标 */}
      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      接收中...
    </span>
    {/* 进度百分比 */}
    <span className="font-medium tabular-nums">{Math.round(currentDownloadProgress)}%</span>
  </div>
  
  {/* 进度条 */}
  <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-accent to-accent/80 rounded-full transition-all duration-300 ease-out"
      style={{ width: `${currentDownloadProgress}%` }}
    />
  </div>
  
  {/* 文件大小信息 */}
  {progressFromMap && (
    <div className="flex items-center justify-between text-xs text-muted mt-1">
      <span>{formatSize(progressFromMap.receivedSize)}</span>
      <span>/</span>
      <span>{formatSize(progressFromMap.totalSize)}</span>
    </div>
  )}
</div>
```

## UI 改进对比

### 之前
```
┌─────────────────────────────────┐
│ 📄 文件名.pdf (2.5 MB)          │
│                                 │
│ 接收中... 45%                   │
│ ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░           │
└─────────────────────────────────┘
```
**问题**：
- 进度条在卡片内部，占用内容空间
- 没有加载动画
- 没有文件大小详情

### 现在
```
┌─────────────────────────────────┐
│ 📄 文件名.pdf (2.5 MB)          │
└─────────────────────────────────┘
  ⟳ 接收中...              45%
  ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░
  1.1 MB / 2.5 MB
```
**改进**：
- 进度条独立在底部，不占用内容空间
- 有旋转加载动画
- 显示已接收/总大小
- 渐变进度条更美观

## 使用示例

### 基础使用
```typescript
<HistoryItem
  item={{
    id: '123',
    type: 'file',
    fileName: 'document.pdf',
    fileSize: 2621440,
    timestamp: Date.now(),
    status: 'downloading',  // 显示为下载中
    direction: 'received',
    from: '移动端',
    progress: 45  // 当前进度 45%
  }}
  // ... 其他 props
/>
```

### 使用 downloadProgressMap
```typescript
const downloadProgressMap = new Map();
downloadProgressMap.set('123', {
  percent: 45,
  receivedSize: 1179648,
  totalSize: 2621440
});

<HistoryItem
  item={item}
  downloadProgressMap={downloadProgressMap}
  // ... 其他 props
/>
```

## 进度数据优先级

组件支持三种方式传递进度数据，优先级如下：

1. **item.progress** (最高优先级)
   - 直接在 item 对象中设置
   - 适合简单场景

2. **downloadProgress[item.id]**
   - 通过 prop 传递的对象
   - 适合批量管理

3. **downloadProgressMap.get(item.id)** (最低优先级)
   - 通过 Map 传递
   - 包含详细信息（receivedSize, totalSize）
   - 推荐使用

## 性能优化

### 1. 条件渲染
```typescript
// 只在需要时渲染进度条
const showProgress = item.type === 'file' && 
                     isDownloading && 
                     currentDownloadProgress > 0 && 
                     currentDownloadProgress < 100 &&
                     !compact;
```

### 2. 动画优化
```typescript
// 使用 CSS transition 而非 JavaScript 动画
className="transition-all duration-300 ease-out"
```

### 3. 数字格式化
```typescript
// 使用 tabular-nums 保持数字宽度一致，避免抖动
className="font-medium tabular-nums"
```

## 兼容性

### 向后兼容
- 所有新增字段都是可选的
- 不传递进度数据时，组件正常显示
- 支持旧的 `downloadProgress` 和 `downloadProgressMap`

### 紧凑模式
```typescript
<HistoryItem
  item={item}
  compact={true}  // 不显示进度条
/>
```

## 测试场景

### 场景 1: 接收文件（显示进度）
```typescript
item = {
  type: 'file',
  status: 'downloading',
  progress: 45
}
```
**预期**: 显示进度条，45%

### 场景 2: 接收完成
```typescript
item = {
  type: 'file',
  status: 'success',
  progress: 100
}
```
**预期**: 不显示进度条

### 场景 3: 紧凑模式
```typescript
<HistoryItem item={item} compact={true} />
```
**预期**: 即使有进度也不显示

### 场景 4: 文本消息
```typescript
item = {
  type: 'text',
  content: 'Hello'
}
```
**预期**: 不显示进度条

## 相关文件

- `src/shared/components/HistoryItem.tsx` - 组件实现
- `src/renderer/App.tsx` - 桌面端使用
- `src/web/App.tsx` - Web 端使用
- `docs/DOWNLOAD_PROGRESS_EXPLANATION.md` - 下载进度说明

## 总结

通过这次重构：

1. ✅ 修复了 App.tsx 中的所有 TypeScript 错误
2. ✅ 改进了进度条的显示位置和样式
3. ✅ 新增了加载动画和文件大小显示
4. ✅ 提升了用户体验和视觉效果
5. ✅ 保持了向后兼容性

进度条现在独立显示在卡片底部，不占用内容空间，视觉效果更好，信息更完整。
