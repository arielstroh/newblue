@echo off
REM ── One-click publish for the NewBlue site ────────────────────────────
REM Double-click this file to commit all current changes and push to GitHub.
REM Live site: https://arielstroh.github.io/newblue/
cd /d "%~dp0"

set "MSG=%~1"
if "%MSG%"=="" set "MSG=Update site"

echo Committing and pushing changes...
git add -A
git commit -m "%MSG%"
git push

echo.
echo Done. If there was nothing to commit, that is fine - nothing changed.
echo Your site will update at https://arielstroh.github.io/newblue/ in a minute or two.
pause
