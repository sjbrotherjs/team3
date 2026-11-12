@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .env copy .env.example .env >nul
set "CHWIJIK_NODE=C:\Program Files\WindowsApps\OpenAI.CodexPrimaryRuntime.v26-1110-778-0_26.1110.778.0_x64__3k8sg7r9htsxt\dependencies\node\bin\node.exe"
if not exist "%CHWIJIK_NODE%" set "CHWIJIK_NODE=node"
echo 취쥐직 로컬 서버를 시작합니다. 중지하려면 Ctrl+C를 누르세요.
echo 접속 주소: http://127.0.0.1:4174
"%CHWIJIK_NODE%" server.cjs
pause