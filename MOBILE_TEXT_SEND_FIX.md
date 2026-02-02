# 移动端文本发送修复

## 问题描述

移动端输入文本后，点击设备无法发送文本消息。

### 问题表现
1. 用户点击"文本"图标，输入文本内容
2. 文本内容显示正常（显示"1"）
3. 设备列表可以点击
4. 但点击设备后没有任何反应，文本未发送

## 问题原因

### 原因 1：设备列表禁用状态判断错误
**位置**：`src/web/components/TransferPage.tsx`

```typescript
// 错误的判断逻辑
canSend={mode === 'file' ? selectedFiles.length > 0 : text.trim().length > 0}
```

**问题**：
- 移动端没有"文件/文本"模式切换按钮
- 用户点击"文本"图标后，`mode` 仍然是 `'file'`
- 当 `mode='file'` 且只有文本内容时，`canSend` 被错误地设置为 `false`
- 导致设备列表被禁用，无法点击

### 原因 2：发送函数类型判断错误
**位置**：`src/web/App.tsx`

```typescript
// 错误的发送逻辑
const handleSend = useCallback((targetDeviceId?: string) => {
  if (mode === 'file') {
    sendFiles(targetDeviceId);
  } else {
    handleSendText(targetDeviceId);
  }
}, [mode, sendFiles, handleSendText]);
```

**问题**：
- 发送函数依赖 `mode` 来判断发送类型
- 移动端 `mode` 始终是 `'file'`
- 即使有文本内容，也会尝试调用 `sendFiles()`
- 由于没有文件，`sendFiles()` 不会执行任何操作

## 解决方案

### 修复 1：设备列表启用状态判断
**文件**：`src/web/components/TransferPage.tsx`

```typescript
// 修复后：直接检查是否有内容
canSend={selectedFiles.length > 0 || text.trim().length > 0}
```

**改进**：
- 不依赖 `mode` 状态
- 只要有文件或文本内容，就允许点击设备
- 适用于桌面端和移动端

### 修复 2：发送函数智能判断
**文件**：`src/web/App.tsx`

```typescript
// 修复后：根据实际内容判断发送类型
const handleSend = useCallback((targetDeviceId?: string) => {
  // 根据实际内容判断发送类型，而不是依赖 mode
  if (selectedFiles.length > 0) {
    sendFiles(targetDeviceId);
  } else if (text.trim()) {
    handleSendText(targetDeviceId);
  }
}, [selectedFiles.length, text, sendFiles, handleSendText]);
```

**改进**：
- 优先检查是否有文件，有则发送文件
- 否则检查是否有文本，有则发送文本
- 不依赖 `mode` 状态，更加健壮
- 适用于所有场景（桌面端和移动端）

### 修复 3：提示文本判断
**文件**：`src/web/components/TransferPage.tsx`

```typescript
// 修复前
{(mode === 'file' ? selectedFiles.length > 0 : text.trim().length > 0) && ...}

// 修复后
{(selectedFiles.length > 0 || text.trim().length > 0) && ...}
```

## 修改的文件

1. `src/web/components/TransferPage.tsx`
   - 修改 `canSend` 判断逻辑（2处）
   - 修改提示文本显示条件

2. `src/web/App.tsx`
   - 修改 `handleSend` 函数的发送类型判断逻辑

## 测试验证

### 移动端测试
1. ✅ 点击"文本"图标打开弹窗
2. ✅ 输入文本内容
3. ✅ 点击"确认"关闭弹窗
4. ✅ 文本内容显示在预览区域
5. ✅ 设备列表可以点击（不再禁用）
6. ✅ 点击设备后文本成功发送
7. ✅ 发送后文本被清空

### 桌面端测试
1. ✅ 切换到"文本"模式
2. ✅ 输入文本内容
3. ✅ 设备列表可以点击
4. ✅ 点击设备后文本成功发送
5. ✅ 发送后文本被清空

### 混合场景测试
1. ✅ 同时有文件和文本时，优先发送文件
2. ✅ 只有文件时，发送文件
3. ✅ 只有文本时，发送文本
4. ✅ 既没有文件也没有文本时，设备列表禁用

## 技术要点

### 1. 不依赖 UI 状态
- `mode` 是 UI 层面的状态（桌面端有切换按钮，移动端没有）
- 业务逻辑应该依赖实际数据（`selectedFiles`、`text`）
- 这样可以避免 UI 状态和数据状态不一致的问题

### 2. 智能类型判断
- 根据实际内容自动判断发送类型
- 优先级：文件 > 文本
- 更加灵活和健壮

### 3. 统一的判断逻辑
- 所有判断都使用相同的条件：`selectedFiles.length > 0 || text.trim().length > 0`
- 保持代码一致性，减少维护成本

## 经验总结

1. **避免 UI 状态污染业务逻辑**
   - UI 状态（如 `mode`）应该只用于控制 UI 显示
   - 业务逻辑应该依赖实际数据状态

2. **移动端和桌面端的差异**
   - 移动端可能没有某些 UI 控件（如模式切换按钮）
   - 业务逻辑应该兼容两种场景

3. **智能判断优于显式状态**
   - 根据实际内容自动判断类型，比维护额外的状态更可靠
   - 减少状态同步的复杂度

## 相关问题

这个问题的根本原因是移动端和桌面端的 UI 设计差异：
- **桌面端**：有"文件/文本"模式切换按钮，`mode` 状态有意义
- **移动端**：没有模式切换按钮，直接通过快捷图标操作，`mode` 状态失去意义

解决方案是让业务逻辑不依赖 `mode`，而是根据实际内容智能判断，这样可以同时兼容两种场景。
