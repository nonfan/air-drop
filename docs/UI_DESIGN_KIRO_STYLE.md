# Kiro 风格 UI 设计实现

## 概述

本文档记录了如何实现类似 Kiro 软件的现代化 UI 设计，包括无边框窗口、圆角、边框线和自定义标题栏。

## 主要特性

### 1. 无边框窗口配置

**文件：** `src/main/window.ts`

```typescript
const mainWindow = new BrowserWindow({
  width: 900,
  height: 750,
  frame: false,        // 移除默认边框
  transparent: true,   // 启用透明背景
  resizable: true,
  minWidth: 900,
  minHeight: 650,
  // ...
});
```

**关键配置：**
- `frame: false` - 移除系统默认的标题栏和边框
- `transparent: true` - 允许窗口背景透明，实现圆角效果

### 2. 窗口圆角和边框

**文件：** `src/renderer/index.css`

```css
.app {
  @apply w-screen h-screen overflow-hidden flex flex-col select-none;
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: 12px;                                    /* 圆角 */
  border: 1px solid rgba(255, 255, 255, 0.08);           /* 细边框 */
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5),              /* 外边框阴影 */
              0 8px 32px rgba(0, 0, 0, 0.4);             /* 窗口阴影 */
}
```

**设计要点：**
- `border-radius: 12px` - 窗口圆角，与 Kiro 保持一致
- 双层边框：
  - 内层：`rgba(255, 255, 255, 0.08)` - 微妙的白色边框
  - 外层：`box-shadow` 实现的黑色边框
- 窗口阴影增强立体感

### 3. 自定义标题栏

**文件：** `src/renderer/components/Titlebar.tsx`

#### 3.1 整体布局

```tsx
<div className="h-12 bg-secondary/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 rounded-t-[12px]">
```

**样式特点：**
- `h-12` - 高度 48px，比标准标题栏略高
- `bg-secondary/50` - 半透明背景
- `backdrop-blur-xl` - 毛玻璃效果
- `border-b border-white/5` - 底部细边框
- `rounded-t-[12px]` - 顶部圆角，与窗口圆角匹配

#### 3.2 左侧 Logo 区域

```tsx
<div className="flex items-center gap-3 titlebar-drag flex-1 h-full">
  <div className="flex items-center gap-2.5">
    <Logo className="w-5 h-5" showText={true} />
  </div>
</div>
```

**功能：**
- `titlebar-drag` - 可拖动区域（CSS: `-webkit-app-region: drag`）
- Logo + 应用名称组合
- `flex-1` - 占据剩余空间

#### 3.3 右侧窗口控制按钮

```tsx
<div className="flex gap-2 titlebar-no-drag">
  {/* 最小化 */}
  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-white/5 hover:text-primary transition-all">
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
      <path d="M5 12h14" />
    </svg>
  </button>
  
  {/* 最大化 */}
  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-white/5 hover:text-primary transition-all">
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  </button>
  
  {/* 关闭 */}
  <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-danger/90 hover:text-white transition-all">
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  </button>
</div>
```

**按钮设计：**
- 尺寸：`w-8 h-8` (32x32px)
- 圆角：`rounded-lg`
- 图标：`w-3.5 h-3.5` (14x14px)
- 悬停效果：
  - 最小化/最大化：`hover:bg-white/5` - 微妙的白色背景
  - 关闭：`hover:bg-danger/90` - 红色背景
- `titlebar-no-drag` - 不可拖动区域

### 4. 窗口控制功能

#### 4.1 IPC 通信

**Preload (src/main/preload.ts):**
```typescript
minimize: () => ipcRenderer.send('window-minimize'),
maximize: () => ipcRenderer.send('window-maximize'),
close: () => ipcRenderer.send('window-close'),
```

**主进程 (src/main/ipc/window.ts):**
```typescript
ipcMain.on('window-minimize', () => getMainWindow()?.minimize());

ipcMain.on('window-maximize', () => {
  const win = getMainWindow();
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();  // 已最大化则还原
    } else {
      win.maximize();     // 未最大化则最大化
    }
  }
});

ipcMain.on('window-close', () => getMainWindow()?.hide());
```

#### 4.2 最大化切换逻辑

点击最大化按钮时：
1. 检查窗口当前状态 `isMaximized()`
2. 如果已最大化 → 调用 `unmaximize()` 还原
3. 如果未最大化 → 调用 `maximize()` 最大化

### 5. 拖动区域配置

**CSS (src/renderer/index.css):**
```css
.titlebar-drag {
  -webkit-app-region: drag;
}

.titlebar-no-drag {
  -webkit-app-region: no-drag;
}
```

**使用规则：**
- 标题栏大部分区域应用 `titlebar-drag` - 可拖动
- 按钮区域应用 `titlebar-no-drag` - 不可拖动，保证按钮可点击

## 颜色方案

### 深色主题（默认）

```css
:root {
  --bg-primary: #0f0f12;      /* 主背景 */
  --bg-secondary: #18181c;    /* 次要背景 */
  --bg-tertiary: #1f1f24;     /* 第三级背景 */
  --bg-hover: #26262c;        /* 悬停背景 */
  --border: #2a2a32;          /* 边框颜色 */
  --text-primary: #ffffff;    /* 主文本 */
  --text-secondary: #a0a0a8;  /* 次要文本 */
  --text-muted: #6b6b74;      /* 弱化文本 */
  --accent: #3b82f6;          /* 强调色（蓝色）*/
  --accent-hover: #2563eb;    /* 强调色悬停 */
  --success: #22c55e;         /* 成功色（绿色）*/
  --danger: #ef4444;          /* 危险色（红色）*/
}
```

### 边框和阴影

- **窗口边框：** `rgba(255, 255, 255, 0.08)` - 8% 不透明度的白色
- **分隔线：** `border-white/5` - 5% 不透明度的白色
- **悬停背景：** `hover:bg-white/5` - 5% 不透明度的白色
- **窗口阴影：** 
  - 内阴影：`0 0 0 1px rgba(0, 0, 0, 0.5)`
  - 外阴影：`0 8px 32px rgba(0, 0, 0, 0.4)`

## 视觉效果

### 1. 毛玻璃效果

```css
backdrop-blur-xl  /* Tailwind: blur(24px) */
```

应用于标题栏，创建现代化的半透明效果。

### 2. 过渡动画

```css
transition-all  /* 所有属性平滑过渡 */
```

应用于按钮，提供流畅的交互反馈。

### 3. 圆角层次

- 窗口外层：`12px`
- 标题栏顶部：`12px`（匹配窗口）
- 按钮：`8px`（`rounded-lg`）
- 其他组件：`6px` - `12px` 不等

## 对比 Kiro

| 特性 | Kiro | 本实现 | 说明 |
|------|------|--------|------|
| 窗口圆角 | ✓ | ✓ | 12px 圆角 |
| 边框线 | ✓ | ✓ | 双层边框设计 |
| 无边框窗口 | ✓ | ✓ | frame: false |
| 自定义标题栏 | ✓ | ✓ | 自定义组件 |
| Logo + 名称 | ✓ | ✓ | 左上角 |
| 窗口控制按钮 | ✓ | ✓ | 最小化、最大化、关闭 |
| 毛玻璃效果 | ✓ | ✓ | backdrop-blur |
| 深色主题 | ✓ | ✓ | 默认深色 |
| 按钮悬停效果 | ✓ | ✓ | 微妙的背景变化 |

## 最佳实践

### 1. 圆角一致性

确保窗口圆角和标题栏圆角匹配：
```css
.app { border-radius: 12px; }
.titlebar { rounded-t-[12px]; }  /* 顶部圆角 */
```

### 2. 透明度层次

使用不同透明度创建视觉层次：
- 边框：5-8%
- 悬停：5-10%
- 背景：50%

### 3. 拖动区域

- 标题栏主体：可拖动
- 按钮和交互元素：不可拖动
- 使用 `titlebar-drag` 和 `titlebar-no-drag` 类

### 4. 按钮反馈

- 最小化/最大化：微妙的白色背景
- 关闭：明显的红色背景
- 使用 `transition-all` 实现平滑过渡

## 注意事项

### 1. Windows 特定问题

- 透明窗口在某些 Windows 版本可能有性能问题
- 建议测试不同 Windows 版本的兼容性

### 2. 最大化状态

- 窗口最大化时，圆角会被系统覆盖
- 可以监听 `maximize` 和 `unmaximize` 事件调整样式

### 3. 高 DPI 显示

- 使用相对单位（rem、em）而非固定像素
- 测试不同缩放比例下的显示效果

## 相关文件

- `src/main/window.ts` - 窗口配置
- `src/main/ipc/window.ts` - 窗口控制 IPC
- `src/main/preload.ts` - Preload 脚本
- `src/renderer/components/Titlebar.tsx` - 标题栏组件
- `src/renderer/components/Logo.tsx` - Logo 组件
- `src/renderer/index.css` - 全局样式
- `src/renderer/types.d.ts` - TypeScript 类型定义

## 版本信息

- 实现日期：2026-02-05
- 参考软件：Kiro IDE
- 设计风格：现代化、简约、深色主题
