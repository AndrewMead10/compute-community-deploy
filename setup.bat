@echo off
echo Setting up Decentralized LLM GPU Sharing Application...

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Node.js is not installed. Please install Node.js (v14 or higher) and try again.
    exit /b 1
)

:: Check Node.js version
for /f "tokens=1,2,3 delims=." %%a in ('node -v') do (
    set NODE_MAJOR=%%a
)
set NODE_MAJOR=%NODE_MAJOR:~1%

if %NODE_MAJOR% LSS 14 (
    echo Node.js version %NODE_MAJOR% detected. This application requires Node.js v14 or higher.
    exit /b 1
)

echo Node.js v%NODE_MAJOR% detected.

:: Install dependencies
echo Installing dependencies...
call npm install

if %ERRORLEVEL% EQU 0 (
    echo Dependencies installed successfully!
    echo You can now run the application with:
    echo npm start
) else (
    echo Failed to install dependencies. Please check the error messages above.
    exit /b 1
) 