@echo off
rem Cria a conta de uma professora, a turma (se nao existir) e atribui o simulado publicado.
setlocal
cd /d "%~dp0"
echo.
echo === Criar conta de professora ===
echo.
set "EMAIL="
set "NOME="
set "TURMA="
set /p EMAIL=E-mail (login) da professora:
set /p NOME=Nome completo:
set /p TURMA=Turma [Enter = Grupo principal]:
if "%TURMA%"=="" set "TURMA=Grupo principal"
call scripts\run-node.cmd scripts\manage-account.ts professora "%EMAIL%" "%NOME%" "%TURMA%"
echo.
pause
endlocal
