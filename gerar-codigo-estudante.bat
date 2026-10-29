@echo off
rem Gera um codigo de acesso para estudantes criarem a conta sozinhos.
setlocal
cd /d "%~dp0"
echo.
echo === Gerar codigo de acesso para estudantes ===
echo.
set "USOS="
set "DIAS="
set "TURMA="
set "EMAIL="
set /p USOS=Quantos alunos poderao usar este codigo? [Enter = 1]:
if "%USOS%"=="" set "USOS=1"
set /p DIAS=Valido por quantos dias? [Enter = 14]:
if "%DIAS%"=="" set "DIAS=14"
set /p TURMA=Turma [Enter = Grupo principal]:
if "%TURMA%"=="" set "TURMA=Grupo principal"
set /p EMAIL=Restringir a um e-mail especifico? [Enter = nao]:

if "%EMAIL%"=="" (
  call scripts\run-node.cmd scripts\create-student-code.ts --usos "%USOS%" --dias "%DIAS%" --clase "%TURMA%"
) else (
  call scripts\run-node.cmd scripts\create-student-code.ts --usos "%USOS%" --dias "%DIAS%" --clase "%TURMA%" --email "%EMAIL%"
)
echo.
pause
endlocal
