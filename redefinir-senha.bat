@echo off
rem Gera uma senha nova para qualquer conta (aluno, professora ou administracao).
setlocal
cd /d "%~dp0"
echo.
echo === Redefinir senha ===
echo.
set "EMAIL="
set /p EMAIL=E-mail (login) da conta:
call scripts\run-node.cmd scripts\manage-account.ts redefinir "%EMAIL%"
echo.
pause
endlocal
