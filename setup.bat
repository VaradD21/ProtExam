@echo off
REM ProExam Setup Script for Windows

echo.
echo 7 ProExam Setup Script
echo ======================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo Y Node.js is installed (%NODE_VERSION%)
echo.

REM Install backend dependencies
echo 5 Installing backend dependencies...
cd backend
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo X Failed to install backend dependencies
    pause
    exit /b 1
)

echo Y Backend dependencies installed
echo.

REM Create .env file if it doesn't exist
if not exist .env (
    echo 5 Creating .env file from .env.example...
    copy ..\env.example .env
    echo ! Please update .env with your configuration
)

echo.
echo Y Setup complete!
echo.
echo Next steps:
echo 1. Update .env if needed
echo 2. Run 'npm start' in the backend directory
echo 3. Open http://localhost:8000 in your browser
echo.
pause
