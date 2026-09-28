@echo off
cd /d "%~dp0"
echo Codex Usage Meter - sidebar installer
echo Requires Python 3.10+, Node.js 24+, and Codex.
echo The launcher enables a local debugging endpoint. Keep it private.
py -3 installers\install_sidebar.py
pause
