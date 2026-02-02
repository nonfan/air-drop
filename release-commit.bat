@echo off
echo ========================================
echo 准备上线提交
echo ========================================
echo.

git add -A
git commit -m "chore: 清理测试数据和文档，准备 v1.6.0 发布

- 清除测试历史记录数据
- 删除冗余开发文档
- 创建完整的 README.md
- 添加生产环境配置
- 创建上线检查清单
- 保留重要功能文档"

echo.
echo ========================================
echo 提交完成！
echo ========================================
echo.
echo 下一步：
echo 1. 运行测试：npm run build
echo 2. 打包应用：npm run dist
echo 3. 创建标签：git tag v1.6.0
echo 4. 推送代码：git push origin main --tags
echo.
pause
