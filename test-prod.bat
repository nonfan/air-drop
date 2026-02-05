@echo off
echo 测试生产模式...
echo.

REM 清理进程
taskkill /F /IM electron.exe 2>nul
taskkill /F /IM node.exe 2>nul

REM 构建并启动
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo 构建失败！
    pause
    exit /b 1
)

echo.
echo 启动应用...
call npm start
