@echo off
setlocal
cd /d "%~dp0"

for /f %%i in ('powershell -NoLogo -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm"') do set TS=%%i

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Ce dossier n est pas un depot Git.
  pause
  exit /b 1
)

echo === Publication GitHub ===
git add app.js index.html style.css print.css assets/sites database4.ico favicon.ico RULES_FONCTIONNEMENT.md
git commit -m "Publish dashboard %TS%" >nul 2>&1
git push

echo === Terminé ===
pause
