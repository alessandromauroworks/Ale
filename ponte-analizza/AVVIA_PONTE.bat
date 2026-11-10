@echo off
cd /d "%~dp0"
title Ponte Analizza
where python >nul 2>nul
if %errorlevel%==0 (
  python ponte_analizza.py
) else (
  py ponte_analizza.py
)
echo.
echo Il ponte si e' fermato. Premi un tasto per chiudere.
pause >nul
