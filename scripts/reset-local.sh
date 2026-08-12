#!/usr/bin/env bash
# DESTRUCTIVE: wipes the pgdata volume and rebuilds from scratch.
# Use start-local.sh for routine restarts without data loss.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Load env file so DATABASE_URL is available for validation
if [[ -f "apps/api/.env" ]]; then
  # shellcheck source=/dev/null
  source apps/api/.env
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "ERROR: DATABASE_URL is not set. Configure apps/api/.env before running this script." >&2
  exit 1
fi

echo "==> [reset-local] Stopping all services and removing pgdata volume..."
docker compose down -v

echo "==> [reset-local] Starting PostgreSQL..."
docker compose up -d postgres

echo "==> [reset-local] Waiting for PostgreSQL to be ready (up to 30s)..."
TRIES=0
until docker compose exec postgres pg_isready -U iptvflix -q 2>/dev/null; do
  TRIES=$((TRIES + 1))
  if [[ $TRIES -ge 30 ]]; then
    echo "ERROR: PostgreSQL did not become ready within 30 seconds." >&2
    exit 1
  fi
  sleep 1
done
echo "    PostgreSQL is ready."

echo "==> [reset-local] Running Drizzle migrations..."
pnpm --filter api db:migrate

echo "==> [reset-local] Starting API and Web..."
pnpm dev &
DEV_PID=$!

cleanup() {
  kill "$DEV_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "==> [reset-local] Waiting for API to be ready (up to 30s)..."
TRIES=0
until curl -sf http://localhost:3000/health >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [[ $TRIES -ge 30 ]]; then
    echo "    WARNING: API health endpoint not responding after 30s."
    break
  fi
  sleep 1
done
[[ $TRIES -lt 30 ]] && echo "    API is ready."

echo "==> [reset-local] Waiting for Web to be ready (up to 30s)..."
TRIES=0
until curl -sf http://localhost:5173 >/dev/null 2>&1; do
  TRIES=$((TRIES + 1))
  if [[ $TRIES -ge 30 ]]; then
    echo "    WARNING: Web dev server not responding after 30s."
    break
  fi
  sleep 1
done
[[ $TRIES -lt 30 ]] && echo "    Web is ready."

# Determine LAN IP (macOS: en0; Linux: first address from hostname -I)
if command -v ipconfig >/dev/null 2>&1; then
  HOST_IP="$(ipconfig getifaddr en0 2>/dev/null || echo '<your-host-ip>')"
else
  HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '<your-host-ip>')"
fi

echo ""
echo "Stack is up. Access points:"
echo "  Local  API health: http://localhost:3000/health"
echo "  Local  Web:        http://localhost:5173"
echo "  Remote Web:        http://${HOST_IP}:5173"
echo ""
echo "Press Ctrl-C to stop all services."

wait "$DEV_PID" || true
