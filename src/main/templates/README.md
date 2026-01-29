# Templates 文件夹

## 说明

这个文件夹在**源码中为空**，但在**构建后**会包含网页端模板文件。

## 构建流程

```bash
npm run build:web
```

执行步骤：
1. 使用 Vite 构建 `src/web/` 下的 React 应用
2. 打包成单个 HTML 文件到 `dist/web/index.html` (172KB)
3. 自动复制到 `dist/main/templates/mobile-web.html`

## 文件说明

### 源码目录 (`src/main/templates/`)
- ✅ 空文件夹（旧的 HTML/CSS/JS 已删除）
- ✅ 仅包含此 README

### 构建目录 (`dist/main/templates/`)
- ✅ `mobile-web.html` - React 打包后的单文件（自动生成）

## 工作原理

### 开发模式
```
手机浏览器 → webServer.ts (代理) → http://localhost:5174 (Vite Dev Server)
```

### 生产模式
```
手机浏览器 → webServer.ts → dist/main/templates/mobile-web.html
```

## 注意事项

1. **不要手动编辑** `dist/main/templates/mobile-web.html`
2. 修改网页端请编辑 `src/web/` 下的文件
3. 运行 `npm run build:web` 重新构建
4. 旧的模板文件已删除，现在使用 React 版本

## 相关文件

- `src/web/` - 网页端 React 源码
- `vite.config.web.ts` - 网页端构建配置
- `src/main/services/webServer.ts` - Web 服务器（提供模板文件）
