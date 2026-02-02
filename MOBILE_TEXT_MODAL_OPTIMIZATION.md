# 移动端文本输入弹窗优化

## 优化内容

### 1. 弹窗样式改进
- **从居中弹窗改为底部弹出** - 更符合移动端交互习惯
- **添加顶部拖动条** - 视觉提示可以下滑关闭
- **使用 `animate-slide-up` 动画** - 从底部滑入效果
- **添加 `safe-area-bottom`** - 适配 iOS 底部安全区域

### 2. 键盘适配功能 ⭐ NEW
- **自动检测键盘弹出** - 使用 `window.visualViewport` API 监听键盘状态
- **动态调整弹窗位置** - 键盘弹出时，弹窗自动向上推，避免被遮挡
- **平滑过渡动画** - 使用 `transition-transform duration-200` 实现平滑移动
- **键盘收起恢复** - 键盘收起时，弹窗自动回到底部位置

#### 键盘适配实现原理
```typescript
// 监听 visualViewport 变化
const handleResize = () => {
  if (window.visualViewport) {
    // 计算键盘高度：窗口高度 - 可视区域高度
    const keyboardHeight = window.innerHeight - window.visualViewport.height;
    setKeyboardHeight(keyboardHeight > 0 ? keyboardHeight : 0);
  }
};

// 应用到弹窗样式
style={{
  transform: `translateY(-${keyboardHeight}px)`,
  animation: keyboardHeight > 0 ? 'none' : undefined
}}
```

### 3. 按钮布局优化
- **从单个"发送"按钮改为"取消"和"确认"两个按钮**
- **左右并排布局** - 使用 `flex gap-3` 实现
- **取消按钮** - 使用次要样式（`bg-tertiary`），点击后关闭弹窗并清空文本
- **确认按钮** - 使用主要样式（`bg-accent`），点击后关闭弹窗但保留文本

### 4. 交互流程优化
**之前的流程：**
1. 点击"文本"图标打开弹窗
2. 输入文本
3. 点击"发送"按钮直接发送到已选设备

**优化后的流程：**
1. 点击"文本"图标打开弹窗
2. 输入文本（键盘弹出时弹窗自动上推）
3. 点击"确认"按钮关闭弹窗（文本保留）
4. 点击设备列表中的设备进行发送

**优势：**
- 用户可以先准备好文本内容
- 确认后可以选择发送给哪个设备
- 更灵活的发送流程
- 键盘不会遮挡输入框和按钮

### 5. 文本输入区域优化
- **高度从 `h-32` 增加到 `h-40`** - 提供更多输入空间
- **保持自动聚焦** - 打开弹窗时自动聚焦输入框
- **确认按钮禁用逻辑** - 文本为空时禁用确认按钮

## 修改的文件

### src/web/components/common/TextModal.tsx
```typescript
// 主要改动：
1. 导入 useEffect 和 useState
2. 添加 keyboardHeight 状态管理
3. 使用 visualViewport API 监听键盘变化
4. 动态调整弹窗 transform 样式
5. 键盘弹出时禁用初始动画
6. 组件卸载时清理事件监听器
```

### src/web/App.tsx
```typescript
// 主要改动：
1. onSend 改为 onConfirm
2. onClose 时清空文本
3. onConfirm 时只关闭弹窗，保留文本
4. 移除 disabled 的设备检查（确认时不需要选择设备）
```

## 样式细节

### 弹窗结构
```
固定容器 (fixed inset-0 z-50 flex items-end)
├── 背景遮罩 (bg-black/60)
└── 内容区域 (bg-secondary rounded-t-3xl)
    ├── 顶部拖动条
    ├── 标题栏（带分隔线）
    ├── 文本输入区域
    └── 底部按钮区域
        ├── 取消按钮 (flex-1)
        └── 确认按钮 (flex-1)
```

### 动画效果
- 背景遮罩：`animate-fade-in` - 淡入
- 内容区域（初始）：`animate-slide-up` - 从底部滑入
- 内容区域（键盘弹出）：`transform: translateY(-${keyboardHeight}px)` - 向上推
- 按钮：`active:scale-[0.98]` - 点击缩放反馈

### 键盘适配细节
- **检测方式**：使用 `window.visualViewport` API（比 window.innerHeight 更准确）
- **监听事件**：`resize` 和 `scroll` 事件
- **过渡时间**：`duration-200` (200ms)
- **动画控制**：键盘弹出时禁用初始滑入动画，避免冲突

## 浏览器兼容性

### Visual Viewport API 支持
- ✅ Chrome 61+
- ✅ Safari 13+
- ✅ Firefox 91+
- ✅ Edge 79+
- ✅ iOS Safari 13+
- ✅ Chrome Android 61+

对于不支持的浏览器，会优雅降级（弹窗保持在底部，不会报错）。

## 测试要点

1. ✅ 点击"文本"图标打开弹窗
2. ✅ 弹窗从底部滑入
3. ✅ 点击输入框，键盘弹出
4. ✅ **键盘弹出时，弹窗自动向上推**
5. ✅ **输入框和按钮不被键盘遮挡**
6. ✅ 点击背景遮罩关闭弹窗
7. ✅ 点击"取消"按钮关闭弹窗并清空文本
8. ✅ 输入文本后点击"确认"按钮
9. ✅ 确认后弹窗关闭，文本保留
10. ✅ **键盘收起时，弹窗平滑回到底部**
11. ✅ 点击设备可以发送保留的文本
12. ✅ 文本为空时"确认"按钮禁用
13. ✅ iOS 底部安全区域适配正常
14. ✅ Android 键盘适配正常

## 用户体验提升

1. **更符合移动端习惯** - 底部弹出是移动端常见的交互模式
2. **更灵活的发送流程** - 可以先准备文本，再选择接收设备
3. **更清晰的操作反馈** - 取消和确认按钮明确区分
4. **更好的视觉引导** - 顶部拖动条提示可以下滑关闭
5. **⭐ 完美的键盘适配** - 键盘弹出时自动调整位置，不遮挡内容
6. **平滑的动画过渡** - 所有状态变化都有流畅的动画效果
