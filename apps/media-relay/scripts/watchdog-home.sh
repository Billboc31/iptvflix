#!/usr/bin/env bash
# Long-running watchdog: keeps media-relay + localhost.run tunnel up.
set -u
ENV_FILE="${MEDIA_RELAY_ENV:-$HOME/.iptvflix/media-relay.env}"
ROOT="/Users/pierrebocquet/iptvflix/apps/media-relay"
PID_DIR="$HOME/.iptvflix"
PORT=18080
LOG="$PID_DIR/watchdog.log"

mkdir -p "$PID_DIR"
exec >>"$LOG" 2>&1

if [[ ! -f "$ENV_FILE" ]]; then
  echo "$(date -Iseconds) missing $ENV_FILE"
  exit 1
fi
# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a
PORT="${PORT:-18080}"

ensure_relay() {
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
    return 0
  fi
  echo "$(date -Iseconds) starting media-relay on :$PORT"
  pkill -f "$ROOT/dist/index.js" 2>/dev/null || true
  cd "$ROOT" || exit 1
  MEDIA_RELAY_SECRET="$MEDIA_RELAY_SECRET" PORT="$PORT" \
    nohup /usr/bin/env node dist/index.js >"$PID_DIR/media-relay.log" 2>&1 &
  echo $! >"$PID_DIR/media-relay.pid"
  sleep 1
}

ensure_tunnel() {
  local url_file="$PID_DIR/media-relay.public-url"
  local public=""
  if [[ -f "$url_file" ]]; then
    public="$(cat "$url_file" 2>/dev/null || true)"
  fi
  if [[ -n "$public" ]] && curl -sf --max-time 8 "$public/health" >/dev/null; then
    return 0
  fi
  echo "$(date -Iseconds) (re)starting localhost.run tunnel"
  pkill -f 'ssh .*localhost.run' 2>/dev/null || true
  rm -f "$PID_DIR/ssh-tunnel.log"
  # detached via launchd already; still use script for PTY
  script -q /dev/null ssh -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 \
    -R "80:127.0.0.1:${PORT}" nokey@localhost.run >"$PID_DIR/ssh-tunnel.log" 2>&1 &
  echo $! >"$PID_DIR/tunnel.pid"
  for _ in $(seq 1 30); do
    public="$(grep -oE 'https://[a-z0-9.-]+\.lhr\.life' "$PID_DIR/ssh-tunnel.log" 2>/dev/null | head -1 || true)"
    if [[ -n "$public" ]]; then
      echo "$public" >"$url_file"
      cat >"$PID_DIR/railway-env.txt" <<EOF
# Coller dans Railway → API → Variables, puis redeploy.

MEDIA_RELAY_URL=$public
MEDIA_RELAY_SECRET=$MEDIA_RELAY_SECRET
EOF
      chmod 600 "$PID_DIR/railway-env.txt"
      echo "$(date -Iseconds) public URL $public"
      return 0
    fi
    sleep 0.5
  done
  echo "$(date -Iseconds) tunnel URL not ready yet"
}

echo "$(date -Iseconds) watchdog start"
while true; do
  ensure_relay
  ensure_tunnel
  sleep 20
done
