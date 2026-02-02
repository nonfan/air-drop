# 路由实现说明

## 概述
已为网页端添加 React Router 支持，实现基于 URL 的页面导航，并使用 Context API 优雅地管理应用状态和方法。

## 技术栈
- **react-router-dom**: 用于客户端路由管理
- **React Context API**: 用于全局状态管理，避免 props drilling

## 架构设计

### Context 驱动架构
使用 Context API 将应用状态和方法集中管理，页面组件通过 `useAppContext` hook 获取所需数据，无需层层传递 props。

```
App.tsx (Provider)
    ↓
AppContext
    ↓
Pages (Consumer)
    ↓
Components
```

## 文件结构
```
src/web/
├── App.tsx                          # 主应用 + Context Provider
├── contexts/                        # Context 定义
│   ├── AppContext.tsx              # 应用上下文
│   └── index.ts                     # 导出文件
├── pages/                           # 页面组件（使用 Context）
│   ├── TransferPageView.tsx        # 传输页面
│   ├── HistoryPageView.tsx         # 历史记录
│   ├── SettingsPageView.tsx        # 设置页面
│   └── index.ts                     # 导出文件
└── components/                      # UI 组件
```

## Context 定义

### AppContext.tsx
```tsx
export interface AppContextType {
  // 状态
  mode: 'file' | 'text';
  devices: Device[];
  selectedDevice: string | null;
  selectedFiles: FileItem[];
  text: string;
  history: HistoryItem[];
  settings: Settings;
  isSending: boolean;
  sendProgress: TransferProgress | null;
  downloadProgress: TransferProgress | null;
  isDragging: boolean;
  copiedId: string | null;
  copyFailedId: string | null;
  copiedTextIds: Set<string>;
  downloadingId: string | null;
  downloadFailedId: string | null;
  downloadedIds: Set<string>;
  downloadFailedIds: Set<string>;
  downloadProgressMap: Map<...>;
  showAllHistory: boolean;
  appVersion: string;
  isMobile: boolean;

  // 方法
  setMode: (mode: 'file' | 'text') => void;
  onSelectDevice: (id: string) => void;
  onFilesChange: (files: FileItem[]) => void;
  onSelectFiles: () => void;
  onTextChange: (text: string) => void;
  onSend: (deviceId?: string) => void;
  onCopyText: (text: string, id: string) => void;
  onDownloadFile: (filePath: string, fileName: string, itemId: string) => void;
  onClearHistory: () => void;
  onToggleShowAll: () => void;
  onSaveSettings: (settings: Partial<Settings>) => void;
  onShowTextModal: () => void;
}
```

### 使用 Context Hook
```tsx
import { useAppContext } from '../contexts/AppContext';

export function MyComponent() {
  const { devices, onSelectDevice } = useAppContext();
  
  return (
    <div>
      {devices.map(device => (
        <button onClick={() => onSelectDevice(device.id)}>
          {device.name}
        </button>
      ))}
    </div>
  );
}
```

## 路由配置

### 路由表
| 路径 | 视图 | 组件 |
|------|------|------|
| `/` | 传输页面 | TransferPageView |
| `/history` | 历史记录 | HistoryPageView |
| `/settings` | 设置页面 | SettingsPageView |

## 实现细节

### 1. App.tsx - Provider 配置

#### 路由包装
```tsx
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
```

#### Context Provider
```tsx
function AppContent() {
  // ... 所有状态和方法定义
  
  const contextValue = {
    mode,
    devices,
    selectedDevice,
    // ... 所有状态
    setMode,
    onSelectDevice: setSelectedDevice,
    onFilesChange: setSelectedFiles,
    // ... 所有方法
  };

  return (
    <AppContext.Provider value={contextValue}>
      {/* 布局和路由 */}
    </AppContext.Provider>
  );
}
```

#### 简化的路由
```tsx
<Routes>
  <Route path="/" element={<TransferPageView />} />
  <Route path="/history" element={<HistoryPageView />} />
  <Route path="/settings" element={<SettingsPageView />} />
</Routes>
```

### 2. 页面组件 - Context 消费

#### TransferPageView
```tsx
export function TransferPageView() {
  const {
    mode,
    setMode,
    devices,
    selectedDevice,
    onSelectDevice,
    // ... 其他需要的状态和方法
  } = useAppContext();

  return (
    <TransferPage
      mode={mode}
      onModeChange={setMode}
      devices={devices}
      selectedDevice={selectedDevice}
      onSelectDevice={onSelectDevice}
      // ... 其他 props
    />
  );
}
```

#### HistoryPageView
```tsx
export function HistoryPageView() {
  const {
    history,
    copiedId,
    onCopyText,
    onDownloadFile
  } = useAppContext();

  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <HistoryView
        history={history}
        copiedId={copiedId}
        onCopyText={onCopyText}
        onDownloadFile={onDownloadFile}
      />
    </div>
  );
}
```

#### SettingsPageView
```tsx
export function SettingsPageView() {
  const { settings, onSaveSettings } = useAppContext();

  return (
    <div className="h-full overflow-y-auto">
      <SettingsPage settings={settings} onSaveSettings={onSaveSettings} />
    </div>
  );
}
```

## 优势对比

### 使用 Context 前
```tsx
// App.tsx - 需要传递大量 props
<Route path="/" element={
  <TransferPageView
    mode={mode}
    onModeChange={setMode}
    devices={devices}
    selectedDevice={selectedDevice}
    onSelectDevice={setSelectedDevice}
    selectedFiles={selectedFiles}
    onFilesChange={setSelectedFiles}
    onSelectFiles={handleSelectFiles}
    text={text}
    onTextChange={setText}
    // ... 还有 20+ 个 props
  />
} />

// TransferPageView.tsx - 需要定义所有 props 类型
interface TransferPageViewProps {
  mode: 'file' | 'text';
  onModeChange: (mode: 'file' | 'text') => void;
  devices: Device[];
  selectedDevice: string | null;
  onSelectDevice: (id: string) => void;
  // ... 还有 20+ 个类型定义
}
```

### 使用 Context 后
```tsx
// App.tsx - 简洁的路由配置
<Route path="/" element={<TransferPageView />} />

// TransferPageView.tsx - 按需获取
export function TransferPageView() {
  const { mode, setMode, devices } = useAppContext();
  // 只获取需要的数据
}
```

## 功能特性

✅ **消除 Props Drilling** - 不再需要层层传递 props
✅ **类型安全** - TypeScript 完整支持，自动补全
✅ **按需获取** - 组件只获取需要的状态和方法
✅ **集中管理** - 所有状态和方法在一处定义
✅ **易于维护** - 添加新状态只需修改 Context
✅ **性能优化** - 可以使用 useMemo 优化 Context 值
✅ **测试友好** - 可以轻松 mock Context 进行测试

## 路由功能

✅ **URL 导航** - 可以通过 URL 直接访问页面
✅ **浏览器前进/后退** - 完整支持浏览器历史记录
✅ **深度链接** - 可以分享和收藏特定页面
✅ **状态同步** - 路由和视图状态自动同步
✅ **移动端和桌面端兼容** - 两种布局都使用相同路由

## 使用示例

### 在任何组件中使用 Context
```tsx
import { useAppContext } from '../contexts/AppContext';

function MyComponent() {
  const { 
    devices, 
    selectedDevice, 
    onSelectDevice 
  } = useAppContext();

  return (
    <div>
      <h2>设备列表</h2>
      {devices.map(device => (
        <button
          key={device.id}
          onClick={() => onSelectDevice(device.id)}
          className={selectedDevice === device.id ? 'active' : ''}
        >
          {device.name}
        </button>
      ))}
    </div>
  );
}
```

### 路由导航
```tsx
import { useNavigate } from 'react-router-dom';

function MyComponent() {
  const navigate = useNavigate();

  return (
    <button onClick={() => navigate('/history')}>
      查看历史记录
    </button>
  );
}
```

## 性能优化

### Context 值优化
```tsx
// 使用 useMemo 避免不必要的重渲染
const contextValue = useMemo(() => ({
  mode,
  devices,
  selectedDevice,
  // ... 其他值
  setMode,
  onSelectDevice,
  // ... 其他方法
}), [mode, devices, selectedDevice, /* 依赖项 */]);
```

### 拆分 Context
如果应用变大，可以拆分成多个 Context：
```tsx
// DeviceContext - 设备相关
// HistoryContext - 历史记录相关
// SettingsContext - 设置相关
```

## 未来扩展

### 添加新页面
```tsx
// 1. 创建页面组件
export function NewPageView() {
  const { someData } = useAppContext();
  return <div>{someData}</div>;
}

// 2. 添加路由
<Route path="/new-page" element={<NewPageView />} />

// 3. 更新视图类型
type View = 'transfer' | 'history' | 'settings' | 'new-page';
```

### 添加新状态
```tsx
// 1. 在 AppContextType 中添加类型
export interface AppContextType {
  // ... 现有类型
  newState: string;
  setNewState: (value: string) => void;
}

// 2. 在 AppContent 中定义状态
const [newState, setNewState] = useState('');

// 3. 添加到 contextValue
const contextValue = {
  // ... 现有值
  newState,
  setNewState
};

// 4. 在任何组件中使用
const { newState, setNewState } = useAppContext();
```

## 最佳实践

1. **按需获取**: 只从 Context 中获取需要的数据
2. **避免过度渲染**: 使用 useMemo 优化 Context 值
3. **类型安全**: 始终定义完整的 TypeScript 类型
4. **错误处理**: 使用 Context 前检查是否在 Provider 内
5. **文档注释**: 为 Context 接口添加清晰的注释

## 注意事项

1. **Context 更新**: Context 值变化会导致所有消费组件重渲染
2. **Provider 位置**: 确保 Provider 在路由之外包装
3. **Hook 规则**: useAppContext 必须在 Provider 内部使用
4. **性能监控**: 大型应用考虑使用 React DevTools 监控渲染
