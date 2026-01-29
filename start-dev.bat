@echo off
echo ========================================
echo   Airdrop 开发模式启动
echo ========================================
echo.
echo 启动服务：
echo   - 桌面端渲染进程: http://localhost:5173
echo   - 网页端开发服务器: http://localhost:5174
echo   - Electron 主进程
echo.
echo 按 Ctrl+C 停止所有服务
echo ========================================
echo.

npm run dev:all
