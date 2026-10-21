#!/bin/bash
# Double-click to stop the local game server started by start-server.command.
cd "$(dirname "$0")" || exit 1
PORT=5173
PID_FILE=".server.pid"
if [ -f "$PID_FILE" ]; then pkill -P "$(cat "$PID_FILE")" 2>/dev/null; kill "$(cat "$PID_FILE")" 2>/dev/null; rm -f "$PID_FILE"; fi
PIDS=$(lsof -ti tcp:$PORT 2>/dev/null)
[ -n "$PIDS" ] && kill $PIDS 2>/dev/null
sleep 1
if lsof -ti tcp:$PORT >/dev/null 2>&1; then kill -9 $(lsof -ti tcp:$PORT) 2>/dev/null; fi
echo "サーバーを停止しました。"
sleep 2
