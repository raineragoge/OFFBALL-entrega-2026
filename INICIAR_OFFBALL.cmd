@echo off
cd /d "%~dp0"
if not exist compose.yaml (
  echo Falta compose.yaml. Extrae el ZIP completo.
  pause
  exit /b 1
)
docker compose up -d --build --wait --wait-timeout 180
if errorlevel 1 (
  docker compose ps -a
  docker compose logs --tail=30
  pause
  exit /b 1
)
start "" "http://localhost:5173"
pause
