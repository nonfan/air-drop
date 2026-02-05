# Electron 框架整体修复文档

## 修复日期
2026-02-05

## 修复内容

### 1. Vite 开发服务器配置优化

**问题**：
- Vite 在 Windows 上启动时遇到 `EACCES: permission denied` 权限错误
- 多个端口尝试策略导致配置复杂

**解决方案**：
- 使用标准端口 `5173`（Vite 默认端口）
- 配置 `host: 'localhost'` 避免权限问题
- 设置 `strictPort: false` 允许自动切换端口

**修改文件**：`vite.config.ts`
```typescript
server: {
  port: 5173,
  strictPort: false,
  host: 'localhost'
}
```

### 2. Electron 窗口加载优化

**问题**：
- 多端口尝试逻辑复杂
- 连接失败时缺少重试机制

**解决方案**：
- 简化为单一端口 `5173`
- 实现智能重试机制（30次，每次间隔500ms）
- 添加详细的日志输出

**修改文件**：`src/main/window.ts`
```typescript
// 等待 Vite 开发服务器启动
const maxRetries = 30;
const retryDelay = 500;
let loaded = false;

for (let i = 0; i < maxRetries; i++) {
  try {
    await mainWindow.loadURL('http://localhost:5173');
    loaded = true;
    console.log('[Window] Successfully connected to Vite dev server');
    break;
  } catch (error) {
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
}
```

### 3. UI 边框显示修复

**问题**：
- 窗口底部边框被内容遮挡
- 使用 `border` 属性导致边框在内容下方

**解决方案**：
- 使用 `box-shadow: inset` 创建内边框效果
- 边框始终在内容上方，不会被遮挡
- 添加双层阴影增强视觉效果

**修改文件**：`src/renderer/index.css`
```css
.app {
  border-radius: 12px;
  box-shadow:
    inset 0 0 0 1px var(--border),
    inset 0 0 0 2px rgba(255, 255, 255, 0.03);
  overflow: hidden;
}
```

### 4. 开发脚本优化

**问题**：
- 脚本缺少进程清理
- 缺少编译状态检查
- 输出信息不够清晰

**解决方案**：
- 添加进程清理步骤
- 添加编译错误检查
- 使用 concurrently 的颜色和标签功能
- 优化输出格式

**修改文件**：
- `dev.bat` - 独立启动脚本
- `start-dev.bat` - 简化启动脚本
- `package.json` - npm scripts 优化

### 5. package.json 脚本优化

**修改**：
```json
"scripts": {
  "dev": "concurrently -n \"VITE,ELECTRON\" -c \"cyan,green\" \"npm run dev:vite\" \"npm run dev:electron\"",
  "dev:vite": "vite",
  "dev:electron": "wait-on http://localhost:5173 && tsc -p tsconfig.main.json && set NODE_ENV=development&& electron ."
}
```

**改进点**：
- 添加进程名称标签（`-n`）
- 添加颜色区分（`-c`）
- 使用 `wait-on` 确保 Vite 启动后再启动 Electron
- 分离 Vite 和 Electron 脚本便于调试

## 启动方式

### 方式 1：使用 npm 命令（推荐）
```bash
npm run dev
```

### 方式 2：使用批处理脚本
```bash
# 完整启动（包含清理和编译）
dev.bat

# 简化启动
start-dev.bat
```

### 方式 3：分步启动（调试用）
```bash
# 终端 1：启动 Vite
npm run dev:vite

# 终端 2：启动 Electron
npm run dev:electron
```

## 常见问题

### Q1: 仍然遇到权限错误怎么办？
**A**: 以管理员身份运行 VS Code 或命令行：
- 右键 VS Code → "以管理员身份运行"
- 或右键 `dev.bat` → "以管理员身份运行"

### Q2: Electron 窗口显示空白？
**A**: 检查以下几点：
1. Vite 是否成功启动（查看终端输出）
2. 端口 5173 是否被占用（`netstat -ano | findstr :5173`）
3. 查看 Electron 控制台是否有错误

### Q3: 底部边框仍然不显示？
**A**: 
1. 清除浏览器缓存（Ctrl+Shift+R）
2. 检查 CSS 是否正确加载
3. 使用开发者工具检查 `.app` 元素的样式

### Q4: 编译失败？
**A**: 
1. 删除 `dist` 文件夹
2. 运行 `npm install` 重新安装依赖
3. 检查 TypeScript 错误

## 技术细节

### Vite 配置
- **端口**: 5173（默认）
- **Host**: localhost（避免权限问题）
- **StrictPort**: false（允许自动切换）

### Electron 窗口
- **尺寸**: 900x750（最小 900x650）
- **边框**: 无边框（frame: false）
- **透明**: 是（transparent: true）
- **圆角**: 12px

### 边框实现
- **方法**: box-shadow inset
- **颜色**: var(--border)
- **厚度**: 1px（主边框）+ 2px（高光）

## 性能优化

1. **快速启动**：使用 `wait-on` 确保服务就绪
2. **智能重试**：30次重试，总等待时间15秒
3. **进程清理**：启动前清理旧进程
4. **并发启动**：Vite 和 Electron 并行启动

## 后续建议

1. **生产构建测试**：定期测试 `npm run build` 和 `npm start`
2. **跨平台测试**：在 macOS 和 Linux 上测试启动流程
3. **错误处理**：添加更详细的错误提示和恢复机制
4. **文档更新**：保持文档与代码同步

## 相关文档

- [开发环境设置](./DEV_SETUP.md)
- [UI 设计规范](./UI_DESIGN_KIRO_STYLE.md)
- [UI 修复记录](./UI_FIXES.md)
