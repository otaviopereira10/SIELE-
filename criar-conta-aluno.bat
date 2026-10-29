@echo off
rem Cria diretamente a conta de um aluno (sem codigo) e coloca na turma.
setlocal
cd /d "%~dp0"
echo.
echo === Criar conta de aluno ===
echo.
set "EMAIL="
set "NOME="
set "TURMA="
set /p EMAIL=E-mail (login) do aluno:
set /p NOME=Nome completo:
set /p TURMA=Turma [Enter = Grupo principal]:
if "%TURMA%"=="" set "TURMA=Grupo principal"
call scripts\run-node.cmd scripts\manage-account.ts aluno "%EMAIL%" "%NOME%" "%TURMA%"
echo.
pause
endlocal
