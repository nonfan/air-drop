@echo off
echo Starting Airdrop Development Environment...
echo.

echo Step 1: Building main process...
call npm run build:main
if %errorlevel% neq 0 (
    echo ERROR: Main process build failed!
    pause
    exit /b 1
)
echo Main process built successfully!
echo.

echo Step 2: Starting Vite dev server...
start "Vite Dev Server" cmd /k "npm run dev:renderer"
echo Waiting for Vite to start (5 seconds)...
timeout /t 5 /nobreak >nul
echo.

echo Step 3: Starting Electron...
set NODE_ENV=development
call npx electron .
echo.

echo Development environment stopped.
pause
