@echo off
echo ======================================
echo  WealthPulse Windows Installer
echo ======================================

echo [0/6] Checking System Requirements...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js is not installed. Attempting to install automatically...
    winget install OpenJS.NodeJS -e --source winget --accept-package-agreements --accept-source-agreements
    echo.
    echo Node.js has been installed! 
    echo IMPORTANT: You must close this window, open a new Command Prompt, and run setup-windows.bat again.
    pause
    exit /b
)

echo [1/6] Installing dependencies...
call npm install

echo [2/6] Building production app...
call npm run build

echo [3/6] Installing PM2 process manager...
call npm install -g pm2

echo [4/6] Installing Windows startup support for PM2...
call npm install -g pm2-windows-startup
call pm2-startup install

echo [5/6] Starting WealthPulse in the background...
call pm2 delete wealthpulse 2>nul
call pm2 serve dist 3000 --spa --name "wealthpulse"

echo [6/6] Saving configuration...
call pm2 save

echo ======================================
echo ✅ Installation Complete!
echo WealthPulse is now running silently in the background.
echo It will automatically start whenever you turn on your PC.
echo.
echo Open your browser and visit: http://localhost:3000
echo ======================================
pause
