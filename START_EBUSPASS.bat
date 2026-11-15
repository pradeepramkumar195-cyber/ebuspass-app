@echo off
title e-BusPass Server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Opening download page...
  start https://nodejs.org
  pause
  exit /b
)
if not exist "node_modules\mysql2" (
  echo Installing packages, please wait...
  call npm install
)
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3000"
node server.js
pause
