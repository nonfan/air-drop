@echo off
echo ========================================
echo   网页端开发模式
echo ========================================
echo.
echo 步骤 1: 启动网页端 Vite 开发服务器...
echo.

start "Vite Web" cmd /k "npm run dev:web"

timeout /t 3 /nobreak >nul

echo.
echo 步骤 2: 启动 Electron (开发模式)...
echo.

set NODE_ENV=development
npm start

echo.
echo ========================================
echo   开发服务器已停止
echo ========================================
pause
