@echo off
rem Verificacoes comuns dos arquivos .bat: Node.js, .env.local e dependencias.
cd /d "%~dp0.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale a versao LTS em https://nodejs.org e tente novamente.
  exit /b 1
)
if not exist ".env.local" (
  echo Arquivo .env.local nao encontrado na pasta do projeto. Ele contem as chaves do Supabase.
  exit /b 1
)
if not exist "node_modules\@supabase\supabase-js" (
  echo Instalando dependencias pela primeira vez...
  call npm install
)
node --env-file=.env.local --experimental-strip-types --no-warnings %*
