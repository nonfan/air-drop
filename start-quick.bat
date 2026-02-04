@echo off
echo ========================================
echo Airdrop 生产模式启动
echo ========================================
echo.

REM 清理现有进程
echo [1/3] 清理现有进程...
taskkill /F /IM electron.exe 2>nul
timeout /t 1 /nobreak >nul

REM 构建项目
echo.
echo [2/3] 构建项目...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo 构建失败！
    pause
    exit /b 1
)

REM 启动应用
echo.
echo [3/3] 启动应用...
echo.
echo ========================================
echo 应用正在启动...
echo Web 服务器: http://192.168.0.2:8888
echo ========================================
echo.
set NODE_ENV=production
electron .

