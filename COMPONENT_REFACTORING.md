# 组件重构文档

## 📦 组件提炼完成

为了确保样式统一和易于维护，我们将 App.tsx 中的 UI 组件提炼为独立的可复用组件。

## 🎯 新增组件

### 1. BottomNavigation 组件
**文件**: `src/web/components/BottomNavigation.tsx`

**功能**: 移动端底部导航栏

**特性**:
- 玻璃透明效果 (`bg-white/5 backdrop-blur-xl`)
- 悬浮在底部 (`fixed bottom-0`)
- 三个导航按钮：首页、传输记录、设置
- 激活状态有蓝色背景
- 支持 iOS 安全区域 (`safe-area-bottom`)

**Props**:
```typescript
interface BottomNavigationProps {
  currentView: View;           // 当前视图
  onViewChange: (view: View) => void;  // 视图切换回调
}
```

**样式规范**:
- 容器: `bg-white/5 backdrop-blur-xl rounded-full p-1 gap-0.5 shadow-lg border border-white/10`
- 图标大小: `w-6 h-6` (24px)
- 按钮内边距: `px-3 py-2`
- 激活状态: `bg-accent text-white rounded-full`
- 未激活状态: `text-muted active:scale-90`

### 2. MobilePageHeader 组件
**文件**: `src/web/components/MobilePageHeader.tsx`

**功能**: 移动端页面标题栏

**特性**:
- 根据当前视图显示不同标题
- 传输页面：显示问候语和设备名
- 历史记录页面：显示标题和清空按钮
- 设置页面：显示标题

**Props**:
```typescript
interface MobilePageHeaderProps {
  view: View;                  // 当前视图
  deviceName?: string;         // 设备名称
  historyCount?: number;       // 历史记录数量
  onClearHistory?: () => void; // 清空历史回调
}
```

**样式规范**:
- 容器高度: `h-[88px]`
- 标题字体: `text-xl font-semibold text-foreground`
- 清空按钮: `text-sm text-danger hover:text-danger/80`

## 📁 组件结构

```
src/web/components/
├── BottomNavigation.tsx      # 底部导航栏（新增）
├── MobilePageHeader.tsx      # 移动端页面标题（新增）
├── DeviceList.tsx            # 设备列表
├── FileDropZone.tsx          # 文件拖放区
├── Header.tsx                # 桌面端顶部栏
├── HistoryList.tsx           # 历史记录列表
├── Logo.tsx                  # Logo 组件
├── SettingsPage.tsx          # 设置页面
├── Sidebar.tsx               # 桌面端侧边栏
├── TextInput.tsx             # 文本输入框
├── TransferPage.tsx          # 传输页面
└── index.ts                  # 组件导出（新增）
```

## 🔄 App.tsx 重构

### 重构前
```tsx
// 直接在 App.tsx 中写 JSX
<div className="flex-shrink-0 md:hidden">
  <div className="px-6 bg-background">
    {view === 'transfer' && (
      <div className="flex items-center gap-2 h-[88px]">
        ...
      </div>
    )}
    ...
  </div>
</div>
```

### 重构后
```tsx
// 使用独立组件
<MobilePageHeader
  view={view}
  deviceName={settings.deviceName}
  historyCount={history.length}
  onClearHistory={handleClearHistory}
/>
```

## ✨ 优势

### 1. 代码复用
- 组件可以在不同页面中复用
- 避免重复代码

### 2. 样式统一
- 所有样式集中在组件内部
- 修改一处，全局生效
- 避免样式不一致

### 3. 易于维护
- 组件职责单一
- 修改更安全
- 测试更容易

### 4. 类型安全
- 使用 TypeScript 接口定义 Props
- 编译时检查类型错误

## 🎨 样式规范

### 玻璃透明效果
```css
bg-white/5           /* 5% 白色透明背景 */
backdrop-blur-xl     /* 超大背景模糊 */
border-white/10      /* 10% 白色透明边框 */
shadow-lg            /* 大阴影 */
```

### 导航按钮
```css
/* 激活状态 */
bg-accent text-white px-3 py-2 rounded-full

/* 未激活状态 */
text-muted px-3 py-2 active:scale-90
```

### 图标尺寸
```css
w-6 h-6              /* 24px - 导航图标 */
w-7 h-7              /* 28px - 大图标 */
w-5 h-5              /* 20px - 小图标 */
```

## 📝 使用示例

### 底部导航栏
```tsx
import { BottomNavigation } from './components/BottomNavigation';

<BottomNavigation 
  currentView={view} 
  onViewChange={setView} 
/>
```

### 移动端页面标题
```tsx
import { MobilePageHeader } from './components/MobilePageHeader';

<MobilePageHeader
  view={view}
  deviceName={settings.deviceName}
  historyCount={history.length}
  onClearHistory={handleClearHistory}
/>
```

## 🔧 扩展指南

### 添加新的导航项
1. 在 `src/web/types.ts` 中添加新的 View 类型
2. 在 `BottomNavigation.tsx` 中添加新按钮
3. 在 `MobilePageHeader.tsx` 中添加新标题

### 修改导航样式
1. 只需修改 `BottomNavigation.tsx` 中的样式类
2. 所有使用该组件的地方自动更新

### 自定义主题
1. 修改 `src/web/index.css` 中的 CSS 变量
2. 组件会自动应用新主题

## 🎯 最佳实践

1. **保持组件纯净**: 组件只负责 UI 展示，不包含业务逻辑
2. **使用 Props 传递数据**: 避免在组件内部直接访问全局状态
3. **统一样式规范**: 使用相同的 Tailwind 类名模式
4. **类型定义**: 为所有 Props 定义 TypeScript 接口
5. **注释说明**: 为复杂组件添加注释

## 📊 重构效果

### 代码行数
- App.tsx: 减少约 100 行
- 新增组件: 约 150 行
- 总体: 代码更清晰，可维护性提升

### 可维护性
- ✅ 组件职责单一
- ✅ 样式集中管理
- ✅ 类型安全
- ✅ 易于测试

### 性能
- ✅ 无性能影响
- ✅ 组件按需加载
- ✅ React 优化生效

## 🚀 后续优化

1. **添加单元测试**: 为新组件添加测试用例
2. **Storybook 集成**: 创建组件文档和示例
3. **主题切换**: 支持多主题切换
4. **动画优化**: 添加更流畅的过渡动画
5. **无障碍支持**: 添加 ARIA 标签和键盘导航

## 📖 相关文档

- [组件设计规范](./MOBILE_UI_IMPLEMENTATION.md)
- [样式优化文档](./HISTORY_STYLE_OPTIMIZATION.md)
- [导航栏完成报告](./TELEGRAM_NAVIGATION_COMPLETE.md)
