#!/usr/bin/env bash
# Start local HTTPS media relay for IPTVFlix (home machine).
# Relays Xtream through this Mac + localhost.run SSH tunnel (HTTPS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${MEDIA_RELAY_ENV:-$HOME/.iptvflix/media-relay.env}"
PID_DIR="$HOME/.iptvflix"
RELAY_PID="$PID_DIR/media-relay.pid"
TUNNEL_PID="$PID_DIR/tunnel.pid"
TUNNEL_LOG="$PID_DIR/ssh-tunnel.log"
URL_FILE="$PID_DIR/media-relay.public-url"
RAILWAY_ENV="$PID_DIR/railway-env.txt"

mkdir -p "$PID_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — create it with MEDIA_RELAY_SECRET=..." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a
PORT="${PORT:-18080}"

if [[ -z "${MEDIA_RELAY_SECRET:-}" ]]; then
  echo "MEDIA_RELAY_SECRET missing in $ENV_FILE" >&2
  exit 1
fi

stop_pid() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      # kill process group if launched via script(1)
      kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
      sleep 0.5
      kill -9 -- "-$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
    fi
    rm -f "$file"
  fi
}

stop_pid "$RELAY_PID"
stop_pid "$TUNNEL_PID"
pkill -f 'ssh .*localhost.run' 2>/dev/null || true

cd "$ROOT"
if [[ ! -f dist/index.js ]]; then
  if command -v pnpm >/dev/null; then
    (cd "$ROOT/../.." && pnpm --filter @iptvflix/media-relay build) || true
  fi
  [[ -f dist/index.js ]] || npx tsc -p tsconfig.json
fi

export MEDIA_RELAY_SECRET PORT
nohup node dist/index.js >"$PID_DIR/media-relay.log" 2>&1 &
echo $! >"$RELAY_PID"

for _ in $(seq 1 40); do
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
    break
  fi
  sleep 0.2
done

if ! curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
  echo "media-relay failed to start — see $PID_DIR/media-relay.log" >&2
  exit 1
fi

rm -f "$TUNNEL_LOG" "$URL_FILE"
# script(1) allocates a PTY so localhost.run keeps the session alive under nohup
nohup script -q /dev/null ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 \
  -R "80:127.0.0.1:${PORT}" nokey@localhost.run >"$TUNNEL_LOG" 2>&1 &
echo $! >"$TUNNEL_PID"

PUBLIC_URL=""
for _ in $(seq 1 40); do
  PUBLIC_URL="$(grep -oE 'https://[a-z0-9.-]+\.lhr\.life' "$TUNNEL_LOG" 2>/dev/null | head -1 || true)"
  if [[ -n "$PUBLIC_URL" ]]; then
    break
  fi
  sleep 0.5
done

if [[ -z "$PUBLIC_URL" ]]; then
  echo "Tunnel URL not found — check $TUNNEL_LOG" >&2
  exit 1
fi

echo "$PUBLIC_URL" >"$URL_FILE"
cat >"$RAILWAY_ENV" <<EOF
# Coller dans Railway → API → Variables, puis redeploy.

MEDIA_RELAY_URL=$PUBLIC_URL
MEDIA_RELAY_SECRET=$MEDIA_RELAY_SECRET

# Relancer plus tard: $ROOT/scripts/start-home.sh
EOF
chmod 600 "$RAILWAY_ENV"

echo "media-relay OK  http://127.0.0.1:${PORT}"
echo "public HTTPS   $PUBLIC_URL"
echo ""
echo "Railway vars written to $RAILWAY_ENV"
echo "PIDs: relay=$(cat "$RELAY_PID") tunnel=$(cat "$TUNNEL_PID")"
echo "Note: lhr.life URL changes on tunnel restart."
