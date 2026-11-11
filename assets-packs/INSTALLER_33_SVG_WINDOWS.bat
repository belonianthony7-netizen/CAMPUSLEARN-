@echo off
cd /d "%~dp0"
py -3 telecharger_open_doodles_cc0.py --all
if errorlevel 1 python telecharger_open_doodles_cc0.py --all
pause
