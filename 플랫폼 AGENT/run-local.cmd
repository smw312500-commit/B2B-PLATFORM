@echo off
setlocal

pushd "%~dp0server"
start "platform-server" cmd /k "node index.js"
popd

timeout /t 2 /nobreak > nul

pushd "%~dp0"
start "platform-front" cmd /k "npm.cmd run dev"
popd

echo.
echo http://localhost:5175
pause
