@echo off
setlocal
chcp 65001 >nul
set "PROJECT_DIR=%~dp0"
set "NPM_CLI=%PROJECT_DIR%.local-node\node-v22.22.3-win-x64\npm.cmd"
set "SITE_URL=http://localhost:5173"

if not exist "%NPM_CLI%" (
  echo 找不到项目自带的 Node.js。请确认整个项目文件夹已完整复制。
  pause
  exit /b 1
)

rem 若项目已运行，则直接打开网页，避免重复启动服务。
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2; if ($r.Content.Contains('诗境·AI')) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto open_site

echo 正在启动诗境 AI，请保持随后打开的服务窗口运行。
start "诗境 AI 服务" /D "%PROJECT_DIR%" cmd /k ""%NPM_CLI%" run dev"

echo 等待网页启动...
set /a ATTEMPTS=0
:wait_for_site
powershell -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:5173/' -TimeoutSec 2; if ($r.Content.Contains('诗境·AI')) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto open_site
set /a ATTEMPTS+=1
if %ATTEMPTS% GEQ 30 goto startup_failed
timeout /t 2 /nobreak >nul
goto wait_for_site

:startup_failed
echo 网站暂时没有在 localhost:5173 启动。请查看“诗境 AI 服务”窗口中的错误信息。
pause
exit /b 1

:open_site
echo 正在打开 %SITE_URL%
start "" "%SITE_URL%"
exit /b 0
