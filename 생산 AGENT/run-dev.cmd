@echo off
setlocal

pushd "%~dp0"
start "EM AI AGENT API" /min cmd /c "cd /d \"%~dp0server\" && npm.cmd start"
timeout /t 2 /nobreak >nul
call npm.cmd run dev
set "EXIT_CODE=%ERRORLEVEL%"
popd

exit /b %EXIT_CODE%
