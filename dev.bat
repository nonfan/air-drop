@echo off
chcp 65001 >nul
echo ========================================
echo Airdrop 开发模式启动
echo ========================================
echo.

REM 清理现有进程
echo [1/3] 清理现有进程...
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul

REM 编译主进程
echo.
echo [2/3] 编译主进程...
call npx tsc -p tsconfig.main.json
if %ERRORLEVEL% NEQ 0 (
    echo 编译失败！
    pause
    exit /b 1
)

REM 启动开发环境
echo.
echo [3/3] 启动开发环境...
echo.
echo ========================================
echo Vite 开发服务器: http://localhost:5173
echo 正在启动 Electron...
echo ========================================
echo.

call npx concurrently -n "VITE,ELECTRON" -c "cyan,green" "npx vite" "timeout /t 3 /nobreak >nul && set NODE_ENV=development&& npx electron ."
