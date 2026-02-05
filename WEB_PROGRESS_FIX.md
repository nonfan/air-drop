# 网页端进度显示修复

## 问题描述

用户反馈："左边还在不断显示下载进度，右边直接100%"

### 问题分析

1. **左边进度条**（`TransferPage.tsx` 中的 `sendProgress`）：显示的是发送端的上传进度
2. **右边 History 记录**（`HistoryItem.tsx` 中的 `downloadProgressMap`）：应该显示接收/发送的进度
3. **不同步原因**：
   - 左边的进度条是独立的发送进度显示
   - 右边的 History 记录没有正确接收到进度更新
   - 两个进度条显示的是不同的数据源

## 解决方案

### 1. 移除重复的发送进度条

**文件**: `src/web/components/TransferPage.tsx`

删除了设备列表下方的独立发送进度条，因为：
- 这是重复的 UI 元素
- 进度应该统一在 History 记录中显示
- 避免用户混淆（左边显示实时进度，右边显示 100%）

```typescript
// 删除了这段代码：
{isSending && sendProgress && (
  <div className="bg-secondary border border-custom rounded-lg p-3">
    {/* 进度条内容 */}
  </div>
)}
```

### 2. 在 History 中显示发送进度

**文件**: `src/web/hooks/useHistory.ts`

添加了 `updateHistoryItem` 函数，用于更新 History 记录的进度：

```typescript
const updateHistoryItem = useCallback((id: string, updates: Partial<HistoryItem>) => {
  setHistory(prev => {
    const newHistory = prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    );
    setStorageItem(STORAGE_KEYS.HISTORY, newHistory);
    return newHistory;
  });
}, []);
```

### 3. 发送文件时预先创建 History 记录

**文件**: `src/web/hooks/useFileTransfer.ts`

在发送文件时：
1. 预先创建一个 `downloading` 状态的 History 记录
2. 在上传进度更新时，同步更新 History 记录的 `progress` 字段
3. 上传完成后，将状态更新为 `success`

```typescript
// 预先创建 History 记录
const itemId = `sending-${Date.now()}-${i}`;
if (onCreateSendingHistory) {
  onCreateSendingHistory(fileItem, itemId);
}

// 更新进度
if (onUpdateSendingProgress) {
  onUpdateSendingProgress(itemId, percent);
}

// 完成发送
if (onCompleteSendingHistory) {
  onCompleteSendingHistory(itemId);
}
```

### 4. 在 App.tsx 中连接回调

**文件**: `src/web/App.tsx`

添加了三个回调函数：
- `handleCreateSendingHistory`: 创建发送中的 History 记录
- `handleUpdateSendingProgress`: 更新发送进度
- `handleCompleteSendingHistory`: 完成发送

**重要修复**：发送记录显示目标设备名称，而不是"自己"

```typescript
const handleCreateSendingHistory = useCallback((fileItem: any, itemId: string, targetDeviceName: string) => {
  const item: HistoryItem = {
    id: itemId,
    type: 'file',
    fileName: fileItem.name,
    fileSize: fileItem.size,
    filePath: '',
    timestamp: Date.now(),
    status: 'downloading',
    direction: 'sent',
    from: `发送至 ${targetDeviceName}`, // 显示目标设备名称，避免"自己上传自己接收"的混淆
    progress: 0
  };
  addHistoryItem(item);
}, [addHistoryItem]);
```

在 `useFileTransfer` 中传递 `devices` 数组，用于查找目标设备名称：

```typescript
// 获取目标设备名称
const targetDevice = devices.find(d => d.id === deviceId);
const targetDeviceName = targetDevice ? targetDevice.name : '未知设备';

// 创建 History 记录时传递目标设备名称
if (onCreateSendingHistory) {
  onCreateSendingHistory(fileItem, itemId, targetDeviceName);
}
```

## 效果

修复后：
1. ✅ 移除了重复的发送进度条
2. ✅ 发送文件时，进度统一显示在 History 记录中
3. ✅ 进度实时更新，从 0% 到 100%
4. ✅ 发送完成后，状态自动更新为 `success`
5. ✅ 用户体验更加一致和清晰
6. ✅ **修复了"自己上传自己接收"的问题**：
   - 发送记录显示为"发送至 [目标设备名称]"
   - 接收记录显示为"来自 [发送设备名称]"
   - 不再出现自己给自己发送的混淆情况

## 相关文件

- `src/web/components/TransferPage.tsx` - 移除重复进度条
- `src/web/hooks/useHistory.ts` - 添加更新 History 记录的函数
- `src/web/hooks/useFileTransfer.ts` - 发送文件时创建和更新 History 记录
- `src/web/App.tsx` - 连接回调函数
- `src/shared/components/HistoryItem.tsx` - 显示进度条（已有功能）

## 测试建议

1. 移动端发送文件到桌面端
2. 观察 History 记录中的进度条是否正常显示
3. 确认进度从 0% 平滑增长到 100%
4. 确认发送完成后状态变为成功
5. 确认没有重复的进度条显示
