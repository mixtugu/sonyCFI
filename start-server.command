#!/bin/bash
# Double-click to start the local game server (http://localhost:5173) and open it in Chrome.
cd "$(dirname "$0")" || exit 1
PORT=5173
PID_FILE=".server.pid"; LOG_FILE=".server.log"

if lsof -ti tcp:$PORT >/dev/null 2>&1; then
  echo "サーバーはすでに起動しています: http://localhost:$PORT"
else
  if ! command -v npm >/dev/null 2>&1; then echo "Node.js（npm）が見つかりません。https://nodejs.org からインストールしてください。"; read -n 1 -s -r -p "何かキーを押すと閉じます"; exit 1; fi
  # Install (or repair a node_modules copied from another OS) only when needed.
  if [ ! -x node_modules/.bin/vite ]; then echo "依存パッケージをインストールしています…"; rm -rf node_modules; npm ci || { read -n 1 -s -r -p "インストールに失敗しました。何かキーを押すと閉じます"; exit 1; }; fi
  echo "サーバーを起動しています…"
  nohup npm run dev > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  for i in $(seq 1 30); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 1; done
  if ! curl -s -o /dev/null "http://localhost:$PORT/"; then echo "起動できませんでした。$LOG_FILE を確認してください。"; tail -20 "$LOG_FILE"; read -n 1 -s -r -p "何かキーを押すと閉じます"; exit 1; fi
  echo "起動しました: http://localhost:$PORT"
fi
open -a "Google Chrome" "http://localhost:$PORT/" 2>/dev/null || open "http://localhost:$PORT/"
echo "停止するときは stop-server.command をダブルクリックしてください。"
sleep 2
