@echo off
rem Gera um codigo de acesso para estudantes do SIELE Trainer Pro.
rem Basta dar dois cliques neste arquivo.
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado. Instale a versao LTS em https://nodejs.org e tente novamente.
  pause
  exit /b 1
)
if not exist ".env.local" (
  echo Arquivo .env.local nao encontrado nesta pasta. Ele contem as chaves do Supabase.
  pause
  exit /b 1
)
if not exist "node_modules\@supabase\supabase-js" (
  echo Instalando dependencias pela primeira vez...
  call npm install
)

echo.
echo === Gerar codigo de acesso para estudantes ===
echo.
set "USOS="
set "DIAS="
set "EMAIL="
set /p USOS=Quantos alunos poderao usar este codigo? [Enter = 1]:
if "%USOS%"=="" set "USOS=1"
set /p DIAS=Valido por quantos dias? [Enter = 14]:
if "%DIAS%"=="" set "DIAS=14"
set /p EMAIL=Restringir a um e-mail especifico? [Enter = nao]:

if "%EMAIL%"=="" (
  node --env-file=.env.local --experimental-strip-types --no-warnings scripts\create-student-code.ts --usos "%USOS%" --dias "%DIAS%"
) else (
  node --env-file=.env.local --experimental-strip-types --no-warnings scripts\create-student-code.ts --usos "%USOS%" --dias "%DIAS%" --email "%EMAIL%"
)

echo.
pause
endlocal
