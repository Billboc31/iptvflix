#!/usr/bin/env bash
set -euo pipefail
PID_DIR="$HOME/.iptvflix"
for f in media-relay.pid tunnel.pid cloudflared.pid; do
  if [[ -f "$PID_DIR/$f" ]]; then
    pid="$(cat "$PID_DIR/$f" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.3
      kill -9 "$pid" 2>/dev/null || true
      echo "stopped $f ($pid)"
    fi
    rm -f "$PID_DIR/$f"
  fi
done
pkill -f 'ssh .*localhost.run' 2>/dev/null || true
pkill -f 'cloudflared tunnel --url' 2>/dev/null || true
echo "home media-relay stopped"
