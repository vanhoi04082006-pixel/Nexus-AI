#!/bin/bash
# Auto-restart dev server if it crashes
cd /home/z/my-project
while true; do
  if ! curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q "200"; then
    echo "[$(date)] Server down, restarting..."
    pkill -f "next dev" 2>/dev/null
    sleep 2
    setsid nohup bun run dev > /home/z/my-project/dev.log 2>&1 < /dev/null &
    disown
    sleep 15
    echo "[$(date)] Server restarted"
  fi
  sleep 10
done
