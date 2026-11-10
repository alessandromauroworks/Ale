@echo off
cd /d "%~dp0"
title Ponte Analizza (non chiudere questa finestra)
:giro
where python >nul 2>nul
if %errorlevel%==0 (
  python ponte_analizza.py
) else (
  py ponte_analizza.py
)
echo.
echo Il ponte si e' fermato: riparte da solo tra 10 secondi. Chiudi la finestra per spegnerlo.
timeout /t 10 /nobreak >nul
goto giro
