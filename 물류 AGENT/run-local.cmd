@echo off
setlocal

pushd "%~dp0server"
start "logistics-server" cmd /k "node index.js"
popd

timeout /t 2 /nobreak > nul

pushd "%~dp0"
start "logistics-front" cmd /k "npm.cmd run dev"
popd

echo.
echo http://localhost:5174
pause
