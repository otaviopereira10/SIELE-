@echo off
rem Aplica no Supabase as atualizacoes pendentes do banco de dados (pasta supabase\migrations).
setlocal
cd /d "%~dp0"
echo.
echo === Atualizar o banco de dados ===
echo.
if not exist ".env.local" (
  echo Erro: nao encontrei o arquivo .env.local nesta pasta.
  echo.
  pause
  exit /b 1
)
node --env-file=.env.local scripts\apply-migrations.mjs
echo.
pause
endlocal
