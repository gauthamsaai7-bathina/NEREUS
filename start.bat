@echo off
setlocal
title NEREUS launcher
cd /d "%~dp0"

where python >nul 2>nul || (echo [ERROR] Python 3.10+ was not found on PATH. Install it from python.org and tick "Add to PATH". & pause & exit /b 1)
where npm >nul 2>nul || (echo [ERROR] Node.js 18+ was not found on PATH. Install it from nodejs.org. & pause & exit /b 1)

echo === NEREUS backend setup ===
if not exist "backend\venv\Scripts\activate.bat" (
    echo Creating Python virtual environment...
    python -m venv backend\venv || (echo [ERROR] Could not create the virtual environment. & pause & exit /b 1)
    call backend\venv\Scripts\activate.bat
    python -m pip install --upgrade pip
    pip install -r backend\requirements.txt || (echo [ERROR] pip install failed. & pause & exit /b 1)
) else (
    call backend\venv\Scripts\activate.bat
)

echo === NEREUS frontend setup ===
if not exist "frontend\node_modules" (
    echo Installing frontend packages, this can take a few minutes...
    pushd frontend
    call npm install || (echo [ERROR] npm install failed. & popd & pause & exit /b 1)
    popd
)
if not exist "frontend\.env" copy "frontend\.env.example" "frontend\.env" >nul

echo Starting backend  on http://localhost:8000  (Swagger: http://localhost:8000/docs)
start "NEREUS Backend" cmd /k "cd /d %~dp0backend && call venv\Scripts\activate.bat && uvicorn app.main:app --port 8000"

echo Starting frontend on http://localhost:5173
start "NEREUS Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 6 >nul
start "" http://localhost:5173
echo.
echo NEREUS is starting in two new windows. Close those windows to stop it.
echo Demo login: operator@nereus.demo / nereus2026
endlocal
