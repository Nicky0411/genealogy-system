@echo off
cd /d "%~dp0.."
"D:\node.js\node.exe" "node_modules\tsx\dist\cli.mjs" watch "apps\api\src\main.ts"
