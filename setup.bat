@echo off
setlocal

echo ==========================================
echo      Steam Library Scraper Installer
echo ==========================================
echo.

:: 1. Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed.
    echo.
    echo Attempting to download Node.js installer...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile 'node_installer.msi'"
    
    if exist node_installer.msi (
        echo.
        echo Launching Node.js installer...
        echo Please follow the installation steps.
        start /wait node_installer.msi
        del node_installer.msi
        echo.
        echo [IMPORTANT] Please RESTART your computer to complete the installation.
        echo After restarting, run this 'setup.bat' file again.
        pause
        exit /b
    ) else (
        echo Failed to download Node.js. Please install it manually from https://nodejs.org/
        pause
        exit /b
    )
) else (
    echo [OK] Node.js is installed.
)

:: 2. Verify Project Structure
if not exist "app\package.json" (
    echo [ERROR] Could not find the 'app' folder. 
    echo Please make sure you downloaded all files correctly.
    pause
    exit /b
)

:: 3. Install Dependencies & Playwright (Inside app folder)
echo.
echo [STEP 1/4] Installing Project Dependencies...
cd app
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies. Check your internet connection.
    cd ..
    pause
    exit /b
)

echo.
echo [STEP 2/4] Installing Browser Engines...
call npx playwright install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install browsers.
    cd ..
    pause
    exit /b
)
cd ..

:: 4. Create the Runner Shortcut
echo.
echo [STEP 3/4] Creating shortcut 'run_scraper.bat'...
(
echo @echo off
echo echo Starting Steam Library Scraper...
echo cd app
echo call npm start
echo pause
) > run_scraper.bat

:: 5. Create Configuration File
echo.
echo [STEP 4/4] Configuration
echo.
echo Please enter your Steam Custom URL ID.
echo (Example: from steamcommunity.com/id/YourPlantDad, enter "YourPlantDad")
echo.
set /p STEAM_ID="Enter Steam ID: "

:: Create scraper-settings.json with the user input
(
echo {
echo   "steamAccountID": "%STEAM_ID%"
echo }
) > scraper-settings.json

echo.
echo ==========================================
echo        INSTALLATION COMPLETE!
echo ==========================================
echo.
echo Settings saved to scraper-settings.json.
echo You can now double-click 'run_scraper.bat' to start the tool.
echo.
pause