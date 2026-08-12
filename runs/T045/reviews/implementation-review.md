The review is complete. Here's the summary:

---

## Review T045 — Résultat : IMPLEMENTATION_APPROVED

**Périmètre vérifié :** 4 fichiers fonctionnels (`scripts/reset-local.sh`, `scripts/start-local.sh`, `package.json`, `README.md`). Commit coder propre (7 fichiers exactement, dont 3 artefacts runs/).

**Tous les critères d'acceptation sont satisfaits :**
- Reset destructeur via `docker compose down -v` + `pnpm --filter api db:migrate` — seul le volume `pgdata` est supprimé (confirmé par le docker-compose.yml)
- Non-destructeur séparé avec `docker compose up -d postgres` uniquement
- Postgres en hard-block (exit 1 après 30s), API/Web en avertissement informationnel
- Trap cleanup Ctrl-C fonctionnel
- IP LAN auto-détectée (macOS/Linux) sans hardcoding
- CORS distant non problématique — Vite proxy rend tout same-origin côté navigateur

**Observations mineures (non bloquantes) :**
1. Détection IP macOS limitée à `en0` (Wi-Fi) — fallback explicite géré
2. Commande Tailscale dans le README fragile — `tailscale ip` serait plus robuste
3. Duplication des blocs readiness entre les deux scripts — acceptable à cette taille

IMPLEMENTATION_APPROVED
