All good. Implementation complete.

---

**Files created/modified:**

| File | Action | Description |
|---|---|---|
| `scripts/reset-local.sh` | Created | Destructive reset: `docker compose down -v`, postgres wait, migrations, `pnpm dev` with readiness checks |
| `scripts/start-local.sh` | Created | Non-destructive start: `docker compose up -d postgres`, postgres wait, `pnpm dev` with readiness checks |
| `package.json` | Modified | Added `reset-local` and `start-local` script entries |
| `README.md` | Modified | Added "Local Reset & Remote Testing" section before the API section |

**Key design points:**
- Both scripts use `set -euo pipefail` and resolve `REPO_ROOT` from `${BASH_SOURCE[0]}`, so they work from any directory
- `reset-local.sh` refuses to run if `DATABASE_URL` is unset (sources `apps/api/.env` first)
- Postgres readiness is a hard check (fails after 30s); API/Web checks are informational warnings only
- `pnpm dev` is backgrounded with a `trap cleanup INT TERM EXIT` pattern — Ctrl-C kills it cleanly
- LAN IP auto-detected: `ipconfig getifaddr en0` on macOS, `hostname -I` on Linux; falls back to `<your-host-ip>` if unavailable
- No hard-coded paths, IPs, or developer-specific values anywhere
