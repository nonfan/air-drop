# UI 圆角和边框修复

## 问题描述

1. **底部边框线缺失** - Footer 组件没有明显的边框线
2. **圆角溢出** - 内容在窗口圆角处溢出，破坏了圆角效果

## 修复方案

### 1. 窗口容器 (`src/renderer/index.css`)

**问题：** 内容溢出圆角区域

**修复：**
```css
.app {
  @apply w-screen h-screen flex flex-col select-none;
  background: var(--bg-primary);
  color: var(--text-primary);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5), 0 8px 32px rgba(0, 0, 0, 0.4);
  overflow: hidden; /* 关键：裁剪溢出内容 */
}
```

**说明：**
- 添加 `overflow: hidden` 确保所有子元素都被裁剪在圆角内
- 移除了 Tailwind 的 `overflow-hidden` 类，改为直接在 CSS 中定义

### 2. Footer 组件 (`src/renderer/components/Footer.tsx`)

**问题：** 
- 底部边框不明显
- 缺少底部圆角

**修复：**
```tsx
<div className="flex-shrink-0 px-6 py-3 border-t border-white/5 bg-secondary/50 backdrop-blur-xl rounded-b-[12px]">
```

**改进点：**
- `border-white/5` → 更明显的白色边框（5% 不透明度）
- `backdrop-blur-xl` → 添加毛玻璃效果，与标题栏保持一致
- `rounded-b-[12px]` → 底部圆角，与窗口圆角匹配

### 3. Sidebar 组件 (`src/renderer/components/Sidebar.tsx`)

**问题：** 左下角没有圆角

**修复：**
```tsx
<div className="w-16 bg-secondary border-r border-custom flex flex-col py-3 rounded-bl-[12px]">
```

**改进点：**
- `rounded-bl-[12px]` → 左下角圆角，与窗口圆角匹配

## 圆角层次结构

```
窗口 (.app)
├─ 顶部圆角: 12px
│  └─ Titlebar: rounded-t-[12px]
│
├─ 左侧
│  └─ Sidebar: rounded-bl-[12px] (左下角)
│
└─ 底部圆角: 12px
   └─ Footer: rounded-b-[12px]
```

## 边框层次

### 窗口边框
- 外层：`box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5)` - 黑色边框
- 内层：`border: 1px solid rgba(255, 255, 255, 0.08)` - 白色边框

### 内部分隔线
- Titlebar 底部：`border-b border-white/5`
- Footer 顶部：`border-t border-white/5`
- Sidebar 右侧：`border-r border-custom`

## 视觉效果

### 修复前
- ❌ 内容溢出圆角
- ❌ 底部边框不明显
- ❌ 左下角和右下角没有圆角

### 修复后
- ✅ 所有内容都被裁剪在圆角内
- ✅ 底部边框清晰可见
- ✅ 四个角都有完美的圆角
- ✅ 毛玻璃效果统一（标题栏和底栏）

## 关键技术点

### 1. overflow: hidden
```css
.app {
  overflow: hidden; /* 必须在父容器上设置 */
  border-radius: 12px;
}
```

**作用：**
- 裁剪所有子元素，确保它们不会超出圆角边界
- 必须在设置了 `border-radius` 的容器上使用

### 2. 圆角匹配
所有边缘组件的圆角必须与窗口圆角匹配：
```tsx
// 窗口
border-radius: 12px

// 标题栏（顶部）
rounded-t-[12px]

// 侧边栏（左下）
rounded-bl-[12px]

// 底栏（底部）
rounded-b-[12px]
```

### 3. 边框透明度
使用不同透明度创建层次感：
```css
/* 窗口外边框 */
border: 1px solid rgba(255, 255, 255, 0.08)  /* 8% */

/* 内部分隔线 */
border-white/5  /* 5% */
```

## 测试检查清单

- [ ] 窗口四个角都有完美的圆角
- [ ] 内容不会溢出圆角区域
- [ ] 底部边框线清晰可见
- [ ] 标题栏和底栏的毛玻璃效果一致
- [ ] 侧边栏左下角有圆角
- [ ] 窗口最大化时圆角正常（系统会覆盖）
- [ ] 不同主题下边框都清晰可见

## 相关文件

- `src/renderer/index.css` - 窗口容器样式
- `src/renderer/components/Footer.tsx` - 底栏组件
- `src/renderer/components/Sidebar.tsx` - 侧边栏组件
- `src/renderer/components/Titlebar.tsx` - 标题栏组件

## 版本信息

- 修复日期：2026-02-05
- 相关 Issue：底部边框线缺失，圆角溢出
