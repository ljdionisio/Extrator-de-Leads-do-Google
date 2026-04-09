@echo off
title Lead King - Plataforma Local Digital Prime
color 0A

echo ========================================================
echo                 INICIANDO ENGINE LEAD KING              
echo                  Aguarde o carregamento...              
echo ========================================================
echo.

cd /d "%~dp0"
node index.js || pause
