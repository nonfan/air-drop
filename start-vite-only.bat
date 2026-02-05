@echo off
echo 只启动 Vite 开发服务器...
echo.
echo 请以管理员身份运行此脚本！
echo.

REM 清理端口
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5555') do taskkill /F /PID %%a 2>nul

echo 启动 Vite...
npx vite
