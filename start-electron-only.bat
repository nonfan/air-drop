@echo off
echo 只启动 Electron（需要 Vite 已经在运行）...
echo.

REM 编译主进程
echo 编译主进程...
call npx tsc -p tsconfig.main.json
if %ERRORLEVEL% NEQ 0 (
    echo 编译失败！
    pause
    exit /b 1
)

REM 启动 Electron
echo.
echo 启动 Electron...
set NODE_ENV=development
npx electron .
