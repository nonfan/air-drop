@echo off
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
call tsc -p tsconfig.main.json
if %ERRORLEVEL% NEQ 0 (
    echo 编译失败！
    pause
    exit /b 1
)

REM 启动开发服务器和应用
echo.
echo [3/3] 启动开发环境...
echo.
echo ========================================
echo Vite 开发服务器: http://localhost:5173
echo 正在启动 Electron...
echo ========================================
echo.

REM 使用 start 命令在新窗口启动 Vite
start "Vite Dev Server" cmd /c "vite"

REM 等待 Vite 启动
echo 等待 Vite 启动...
timeout /t 5 /nobreak >nul

REM 启动 Electron
set NODE_ENV=development
electron .
