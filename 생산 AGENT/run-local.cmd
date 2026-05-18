@echo off
setlocal

pushd "%~dp0server"
start "em-server" cmd /k "node index.js"
popd

timeout /t 2 /nobreak > nul

pushd "%~dp0"
start "em-front" cmd /k "npm.cmd run dev"
popd

echo.
echo http://localhost:5173
pause
