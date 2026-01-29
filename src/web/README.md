# 网页端 (Web Client) - 完整功能版本

## 🎉 重大更新

网页端已升级为**完整功能版本**，支持与桌面端相同的所有核心功能！

## ✨ 完整功能

- ✅ 文件上传/下载（支持多文件、拖放、进度显示）
- ✅ 文本消息收发（剪贴板支持）
- ✅ 设备发现和管理
- ✅ 传输历史记录（文件和文本）
- ✅ 设备名称编辑（独立配置）
- ✅ 主题切换（system/dark/light）
- ✅ 通知提醒（浏览器通知）
- ✅ 完整 UI 复刻桌面端
- ✅ 响应式设计（桌面/平板/手机）
- ✅ 数据持久化（localStorage）

## 快速开始

### 开发模式（推荐）

```bash
# 方式 1：同时开发桌面端和网页端（支持热更新）
npm run dev:all

# 方式 2：仅开发桌面端
npm run dev

# 方式 3：仅开发网页端
npm run dev:web
```

**开发模式特性：**
- ✅ 热更新（HMR）- 修改代码立即生效
- ✅ 无需打包 - 直接运行源码
- ✅ 快速调试 - 浏览器开发者工具

### 生产构建

```bash
# 构建网页端（打包成单文件 HTML）
npm run build:web

# 完整构建（桌面端 + 网页端）
npm run build
```

---

## 架构说明

网页端使用 **React + TypeScript + Tailwind CSS** 开发，打包成**单个 HTML 文件**，无需额外的 CSS 或 JS 文件。

### 技术栈

- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Tailwind CSS** - 样式系统（与桌面端一致）
- **Vite** - 构建工具
- **vite-plugin-singlefile** - 打包成单文件

### 目录结构

```
src/web/
├── App.tsx              # 主应用组件
├── main.tsx             # 入口文件
├── index.html           # HTML 模板
├── index.css            # 样式入口
└── components/          # 组件目录
    ├── Logo.tsx         # Logo 组件
    ├── DeviceList.tsx   # 设备列表
    ├── FileDropZone.tsx # 文件拖放区
    ├── TextInput.tsx    # 文本输入
    ├── HistoryList.tsx  # 历史记录
    └── SettingsPage.tsx # 设置页面
```

### 开发流程

#### 1. 开发模式

```bash
npm run dev:web
```

访问 `http://localhost:5173` 进行开发，支持热更新。

#### 2. 构建生产版本

```bash
npm run build:web
```

这会：
1. 使用 Vite 构建 React 应用
2. 通过 `vite-plugin-singlefile` 将所有资源内联到单个 HTML
3. 自动复制到 `dist/main/templates/mobile-web.html`

#### 3. 完整构建

```bash
npm run build
```

同时构建桌面端和网页端。

### 与桌面端的区别

| 特性 | 桌面端 | 网页端（完整版） |
|------|--------|------------------|
| 运行环境 | Electron | 浏览器 |
| 通信方式 | IPC | WebSocket + HTTP |
| 文件访问 | Node.js API | File API + Fetch |
| 打包方式 | 多文件 | 单文件 HTML |
| 体积 | ~100MB | ~189KB |
| 文件上传 | ✅ | ✅ |
| 文件下载 | ✅ | ✅ |
| 设备名称 | 可编辑 | 可编辑（独立） |
| 主题配置 | 保存到文件 | 保存到 localStorage |
| 通知提醒 | 系统通知 | 浏览器通知 |
| 下载路径 | 可选择 | 浏览器控制 |
| 自动接收 | 可配置 | 服务器端控制 |
| 自动启动 | 支持 | 不适用 |

### WebSocket 通信协议

#### 客户端 → 服务器

```typescript
// 注册设备
{ type: 'register', name: string, model: string }

// 发送文本
{ type: 'send-text', text: string, targetId: string }

// 发送文件（TODO）
{ type: 'send-file', file: File, targetId: string }
```

#### 服务器 → 客户端

```typescript
// 设备列表更新
{ type: 'devices-updated', devices: Device[] }

// 接收文本
{ type: 'text-received', text: string, fromId: string }

// 接收文件（TODO）
{ type: 'file-received', fileId: string, fileName: string }
```

### 响应式设计

- **桌面端** (≥1024px): 三栏布局（侧边栏 + 主内容 + 历史记录）
- **平板** (768px-1023px): 两栏布局（侧边栏 + 主内容）
- **手机** (<768px): 单栏布局（仅主内容）

### 已实现功能

#### 核心功能
- ✅ **文件传输**
  - 文件上传（多文件、拖放、点击选择）
  - 文件下载（接收的文件）
  - 实时传输进度
  - 文件大小显示
- ✅ **文本消息**
  - 发送和接收文本
  - 剪贴板粘贴
  - 复制到剪贴板
- ✅ **设备管理**
  - 实时设备发现
  - 设备列表展示
  - 设备选择和连接
- ✅ **传输历史**
  - 完整历史记录
  - 文件和文本分类
  - 时间戳和来源
  - 快速操作（复制、下载）
  - 清空和展开/收起

#### 设置功能
- ✅ **设备名称**：可编辑，保存到 localStorage
- ✅ **主题切换**：system/dark/light，自动应用
- ✅ **通知提醒**：浏览器通知权限管理
- ✅ **连接信息**：服务器地址、状态、协议
- ✅ **下载路径**：浏览器设置说明

#### UI/UX
- ✅ 完整 UI 复刻桌面端（三栏布局）
- ✅ 视图切换（传输/设置）
- ✅ Toast 通知提示
- ✅ 加载和进度动画
- ✅ 拖放视觉反馈
- ✅ 响应式设计

### 待实现功能

- [ ] PWA 支持（离线使用）
- [ ] 文件预览（图片、视频）
- [ ] 批量文件压缩
- [ ] 传输速度显示
- [ ] 二维码扫描连接
- [ ] 多语言支持

### 注意事项

1. **单文件限制**: 所有资源都内联，文件体积会增大
2. **浏览器兼容**: 需要支持 ES2020+ 和 WebSocket
3. **图标资源**: `/icon.png` 需要由服务器提供
4. **CORS**: WebSocket 连接需要正确的 CORS 配置
