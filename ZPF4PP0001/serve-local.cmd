@echo off
cd /d "%~dp0"
call "..\node_modules\.bin\ui5.cmd" serve --config ui5.yaml --port 8082 > ui5-server.log 2> ui5-server-error.log
