# 发送目标设备错误修复

## 问题描述

1. **路由错误**：A 发送给 B，但 C 收到了（目标设备错误）
2. **重复发送**：点击设备一次就发送了，不需要再点击

## 根本原因

### 问题 1：目标设备错误

**原因：**
- 点击设备时调用 `onSelectDevice(deviceId)` 更新状态
- 然后延迟 50ms 调用 `onSend()`
- 但 `onSend()` 使用的是 `selectedDevice` 状态，而不是刚点击的 `deviceId`
- 由于 React 状态更新是异步的，`selectedDevice` 可能还是旧值

**示例场景：**
```
1. 当前选中设备 C
2. 点击设备 B
3. onSelectDevice(B) 被调用，但状态还没更新
4. 50ms 后 onSend() 被调用
5. onSend() 读取 selectedDevice，值仍然是 C
6. 文件被发送到 C 而不是 B
```

### 问题 2：重复发送

这不是 bug，而是设计行为：
- 点击设备一次 = 选中 + 发送
- 这是我们优化后的"点击即发送"功能

## 修复方案

### 核心思路

**不依赖状态更新，直接传递 deviceId**

将 `deviceId` 作为参数直接传递给发送函数，而不是依赖 `selectedDevice` 状态。

### 修复 1：Desktop 端

**文件：** `src/renderer/components/DeviceList.tsx`

```typescript
// 修改 props 定义
interface DeviceListProps {
  onSend: (deviceId?: string) => void;  // 添加可选参数
  onSendText: (deviceId?: string) => void;  // 添加可选参数
  // ...
}

// 修改点击处理
const handleDeviceClick = (deviceId: string) => {
  if (!canSend || isSending) {
    return;
  }

  // 先更新选中的设备
  onSelectDevice(deviceId);
  
  // 直接发送到指定设备，不依赖状态更新
  if (sendMode === 'file') {
    onSend(deviceId);  // 传递 deviceId
  } else {
    onSendText(deviceId);  // 传递 deviceId
  }
};
```

**文件：** `src/renderer/App.tsx`

```typescript
const handleSend = async (targetDeviceId?: string) => {
  // 使用传入的 deviceId 或当前选中的设备
  const deviceId = targetDeviceId || selectedDevice;
  if (!deviceId || !selectedFiles.length) return;
  
  const device = devices.find(d => d.id === deviceId);
  if (!device) return;
  
  // 使用 deviceId 而不是 selectedDevice
  if (device.type === 'mobile') {
    for (const f of selectedFiles) {
      const id = await window.windrop.shareFileWeb(f.path, device.id);
      if (id) setSharedFiles(prev => [...prev, { id, ...f, targetId: device.id }]);
    }
    setSelectedFiles([]);
  } else {
    setIsSending(true);
    try {
      await window.windrop.sendFiles(deviceId, selectedFiles.map(f => f.path));
    } catch {
      setIsSending(false);
    }
  }
};

const handleSendText = async (targetDeviceId?: string) => {
  const deviceId = targetDeviceId || selectedDevice;
  if (!deviceId || !textInput.trim()) return;
  
  const device = devices.find(d => d.id === deviceId);
  if (!device || device.type !== 'mobile') return;
  
  await window.windrop.shareTextWeb(textInput, device.id);
  setTextInput('');
};
```

### 修复 2：移动端

**文件：** `src/web/App.tsx`

```typescript
const handleSendFiles = useCallback(async (targetDeviceId?: string) => {
  // 使用传入的 deviceId 或当前选中的设备
  const deviceId = targetDeviceId || selectedDevice;
  if (!socket || !deviceId || selectedFiles.length === 0) return;

  // ... 发送逻辑使用 deviceId
  formData.append('targetId', deviceId);
  
  console.log('Uploading to:', uploadUrl, 'targetId:', deviceId);
  
  // 保存上次选择的设备
  saveLastDevice(deviceId);
}, [socket, selectedDevice, selectedFiles, saveLastDevice]);

const handleSendText = useCallback((targetDeviceId?: string) => {
  const deviceId = targetDeviceId || selectedDevice;
  if (!socket || !deviceId || !text.trim()) return;

  socket.emit('send-text', {
    text: text.trim(),
    targetId: deviceId
  });

  console.log('Sent text to device:', deviceId);
  saveLastDevice(deviceId);
  setText('');
}, [socket, selectedDevice, text, saveLastDevice]);

// 统一的发送函数
const handleSend = useCallback((targetDeviceId?: string) => {
  if (mode === 'file') {
    handleSendFiles(targetDeviceId);
  } else {
    handleSendText(targetDeviceId);
  }
}, [mode, handleSendFiles, handleSendText]);
```

**文件：** `src/web/components/TransferPage.tsx`

```typescript
interface TransferPageProps {
  onSend: (deviceId?: string) => void;  // 添加可选参数
  // ...
}

// 在 DeviceList 中
<DeviceList
  onSendToDevice={(deviceId) => {
    // 先选中设备，然后直接发送到该设备
    onSelectDevice(deviceId);
    onSend(deviceId);  // 传递 deviceId
  }}
/>
```

## 工作流程

### 修复前（错误）

```
用户点击设备 B
  ↓
onSelectDevice(B) - 更新状态（异步）
  ↓
setTimeout 50ms
  ↓
onSend() - 读取 selectedDevice（可能还是旧值 C）
  ↓
发送到错误的设备 C ❌
```

### 修复后（正确）

```
用户点击设备 B
  ↓
onSelectDevice(B) - 更新状态（异步）
  ↓
onSend(B) - 直接使用传入的 deviceId B
  ↓
发送到正确的设备 B ✅
```

## 优势

### 1. 可靠性
- ✅ 不依赖异步状态更新
- ✅ 直接使用点击时的 deviceId
- ✅ 避免竞态条件

### 2. 向后兼容
- ✅ `deviceId` 参数是可选的
- ✅ 如果不传递，使用 `selectedDevice`
- ✅ 不影响其他调用方式

### 3. 调试友好
- ✅ 添加了日志输出目标设备
- ✅ 可以清楚看到发送到哪个设备

## 测试验证

### 测试场景 1：基本发送

1. 设备 A 选择文件
2. 点击设备 B
3. 验证：设备 B 收到文件 ✅

### 测试场景 2：快速切换设备

1. 设备 A 选择文件
2. 点击设备 B
3. 立即点击设备 C
4. 验证：设备 C 收到文件 ✅

### 测试场景 3：多次发送

1. 设备 A 选择文件
2. 点击设备 B（发送）
3. 再次选择文件
4. 点击设备 C（发送）
5. 验证：B 和 C 各收到一次 ✅

### 测试场景 4：文本发送

1. 设备 A 输入文本
2. 点击设备 B
3. 验证：设备 B 收到文本 ✅

## 日志示例

### 修复前（错误）

```
User clicks device B
onSelectDevice called with: B
selectedDevice state: C (not updated yet)
Sending to device: C  ❌
```

### 修复后（正确）

```
User clicks device B
onSelectDevice called with: B
Uploading to: http://..., targetId: B  ✅
Sent text to device: B  ✅
```

## 修改文件清单

- ✅ `src/renderer/components/DeviceList.tsx` - 添加 deviceId 参数
- ✅ `src/renderer/App.tsx` - 修改 handleSend 和 handleSendText
- ✅ `src/web/App.tsx` - 修改 handleSendFiles 和 handleSendText
- ✅ `src/web/components/TransferPage.tsx` - 更新 props 和调用
- ✅ `SEND_TARGET_FIX.md` - 修复文档

## 注意事项

### 关于"点击即发送"

这是设计的功能，不是 bug：
- 有内容时，点击设备 = 选中 + 发送
- 无内容时，设备禁用，无法点击
- 这样可以减少操作步骤，提升用户体验

如果需要"先选中，再发送"的行为：
1. 移除 `onSendToDevice` prop
2. 只保留 `onSelectDevice`
3. 添加独立的发送按钮

### 状态管理最佳实践

**避免：**
```typescript
// ❌ 依赖异步状态
setState(newValue);
setTimeout(() => {
  useState(); // 可能还是旧值
}, 50);
```

**推荐：**
```typescript
// ✅ 直接传递值
setState(newValue);
doSomething(newValue); // 使用传入的值
```
