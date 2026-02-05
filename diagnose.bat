@echo off
chcp 65001 >nul
echo ========================================
echo Airdrop 开发环境诊断
echo ========================================
echo.

echo [1] 检查 Node.js 版本
node --version
echo.

echo [2] 检查 npm 版本
npm --version
echo.

echo [3] 检查端口占用情况
echo 检查端口 5173 (Vite):
netstat -ano | findstr :5173
echo.
echo 检查端口 8888 (Web Server):
netstat -ano | findstr :8888
echo.
echo 检查端口 3001 (Transfer Server):
netstat -ano | findstr :3001
echo.

echo [4] 检查编译输出
if exist "dist\main\main\main.js" (
    echo ✓ 主进程已编译
) else (
    echo ✗ 主进程未编译
)
echo.

echo [5] 检查依赖安装
if exist "node_modules\electron" (
    echo ✓ Electron 已安装
) else (
    echo ✗ Electron 未安装
)

if exist "node_modules\vite" (
    echo ✓ Vite 已安装
) else (
    echo ✗ Vite 未安装
)

if exist "node_modules\concurrently" (
    echo ✓ Concurrently 已安装
) else (
    echo ✗ Concurrently 未安装
)
echo.

echo [6] 检查配置文件
if exist "vite.config.ts" (
    echo ✓ vite.config.ts 存在
) else (
    echo ✗ vite.config.ts 不存在
)

if exist "tsconfig.main.json" (
    echo ✓ tsconfig.main.json 存在
) else (
    echo ✗ tsconfig.main.json 不存在
)
echo.

echo ========================================
echo 诊断完成
echo ========================================
echo.
pause
