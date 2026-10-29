@echo off
rem Cria a PRIMEIRA conta de administracao (so funciona se ainda nao existir nenhuma).
setlocal
cd /d "%~dp0"
echo.
echo === Criar conta de administracao ===
echo (as proximas contas de administracao se criam no painel /admin/usuarios)
echo.
set "EMAIL="
set "NOME="
set /p EMAIL=E-mail (login):
set /p NOME=Nome completo:
call scripts\run-node.cmd scripts\manage-account.ts admin "%EMAIL%" "%NOME%"
echo.
pause
endlocal
