# 发布 v1.7.0 指南

## 修复的问题

✅ 已移除 `package.json` 中不支持的 `manifest` 配置项

## 发布步骤

### 1. 提交所有更改
```bash
git add .
git commit -m "fix: 移除不支持的 manifest 配置项"
git push origin main
```

### 2. 创建并推送标签
```bash
git tag v1.7.0
git push origin v1.7.0
```

### 3. GitHub Actions 自动执行
推送标签后，GitHub Actions 会自动：
- ✅ 安装依赖
- ✅ 构建项目
- ✅ 打包 Windows 安装包（NSIS 和 Portable）
- ✅ 创建 GitHub Release
- ✅ 上传安装包到 Release
- ✅ 添加 CHANGELOG 到 Release 说明

### 4. 查看发布进度
访问：https://github.com/你的用户名/air-drop/actions

### 5. 发布完成后
访问：https://github.com/你的用户名/air-drop/releases

## 本地测试（可选）

如果想在本地测试打包：

```bash
# 构建项目
npm run build

# 打包（不发布）
npm run pack

# 打包并生成安装包
npm run dist
```

## 注意事项

- ⚠️ 确保 `CHANGELOG.md` 已更新
- ⚠️ 确保版本号正确（package.json: 1.7.0）
- ⚠️ 标签格式必须是 `v1.7.0`（带 v 前缀）
- ⚠️ 推送标签会立即触发构建，无法取消

## 如果发布失败

1. 查看 GitHub Actions 日志
2. 修复问题
3. 删除标签：`git tag -d v1.7.0 && git push origin :refs/tags/v1.7.0`
4. 重新创建标签并推送

## 发布后

- [ ] 测试下载的安装包
- [ ] 更新文档（如果需要）
- [ ] 通知用户新版本发布
