@echo off
setlocal EnableExtensions DisableDelayedExpansion

rem Double-cliquer sur ce fichier. Prerequis : Python 3.11+ et Node.js avec npm.
rem Angular accepte Node.js 22.22.3+ (22.x), 24.15.0+ (24.x) ou 26+.
if /i "%~1"=="--api" goto run_api

where node.exe >nul 2>&1
if errorlevel 1 goto missing_node
node -e "const [major, minor, patch] = process.versions.node.split('.').map(Number); process.exit((major === 22 && (minor > 22 || (minor === 22 && patch >= 3))) || (major === 24 && minor >= 15) || major >= 26 ? 0 : 1)"
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_node

set "step=Acces au dossier backend"
pushd "%~dp0backend" || goto failed
set "venv_python=.venv\windows\Scripts\python.exe"
if exist "%venv_python%" goto install_python

set "step=Creation de l'environnement Python"
py -3 -c "import sys; sys.exit(sys.version_info < (3, 11))" >nul 2>&1
if not errorlevel 1 (
    py -3 -m venv ".venv\windows" || goto failed
) else (
    python -c "import sys; sys.exit(sys.version_info < (3, 11))" >nul 2>&1
    if errorlevel 1 goto missing_python
    python -m venv ".venv\windows" || goto failed
)

:install_python
echo Installation des dependances Python...
set "step=Installation des dependances Python"
"%venv_python%" -m pip install --disable-pip-version-check -r requirements.txt || goto failed

set "step=Mise a jour de la base de donnees"
"%venv_python%" -m alembic upgrade head || goto failed
popd

set "step=Acces au dossier frontend"
pushd "%~dp0frontend" || goto failed
echo Installation des dependances Angular...
set "step=Installation des dependances Angular"
call npm.cmd ci --prefer-offline --no-audit --no-fund || goto failed

set "step=Ouverture de la fenetre API"
start "CampusLearn - API" "%ComSpec%" /d /k call "%~f0" --api || goto failed

echo.
echo Ouvrez http://127.0.0.1:4200 apres la compilation Angular.
echo Pour arreter CampusLearn, fermez les deux fenetres.
echo.
set "step=Demarrage du serveur Angular"
call ".\node_modules\.bin\ng.cmd" serve --proxy-config proxy.conf.json --host 127.0.0.1 --port 4200 || goto failed
popd
exit /b 0

:run_api
pushd "%~dp0backend" || exit /b 1
".venv\windows\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
set "api_status=%errorlevel%"
popd
exit /b %api_status%

:missing_node
echo Installez Node.js 22.22.3+ ^(22.x^), 24.15.0+ ^(24.x^) ou 26+ avec npm.
echo https://nodejs.org/
goto stop

:missing_python
echo Installez Python 3.11 ou plus recent et ajoutez-le au PATH.
echo https://www.python.org/downloads/windows/
goto stop

:failed
echo.
echo Echec - %step%.

:stop
pause
exit /b 1
