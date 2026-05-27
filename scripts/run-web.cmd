@echo off
cd /d "%~dp0..\apps\web"
"D:\node.js\node.exe" "..\..\node_modules\vite\bin\vite.js" --host 0.0.0.0
