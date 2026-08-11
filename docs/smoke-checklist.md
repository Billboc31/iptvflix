# Manual Smoke Checklist — IPTVFlix Batch 1 Vertical Slice

Use this checklist to validate the complete Batch 1 user journey against a real Xtream-configured source locally.

## Prerequisites

- [ ] Docker Desktop is running
- [ ] A real Xtream account (provider URL, username, password)
- [ ] `.env` file filled with your Xtream credentials (see `.env.example`)
- [ ] Database container is running: `docker compose up -d postgres`
- [ ] Migrations applied: `pnpm --filter @iptvflix/api db:migrate`

## Start services

```bash
# In separate terminals:
pnpm --filter @iptvflix/api dev   # API on http://localhost:3000
pnpm --filter @iptvflix/web dev   # Web UI on http://localhost:5173
```

---

## Step 1 — Health check

- [ ] Open `http://localhost:3000/health`
- **Expected**: `{ "status": "ok", "db": "ok" }`

---

## Step 2 — Open the web UI

- [ ] Open `http://localhost:5173` in the browser
- **Expected**: IPTVFlix home page loads (possibly empty content state)

---

## Step 3 — Add a source

- [ ] Navigate to **Sources IPTV** (sidebar)
- [ ] Click **+ Ajouter une source**
- [ ] Fill in:
  - **Nom**: any label (e.g. `My Provider`)
  - **Type**: `XTREAM`
  - **URL de base**: your provider base URL (e.g. `http://provider.example.com`)
  - **Identifiant**: your Xtream username
  - **Mot de passe**: your Xtream password
- [ ] Click **Ajouter**
- **Expected**: Source card appears in the list with an Active badge

---

## Step 4 — Test connection

- [ ] Click **Test** on the source card
- **Expected**: A green toast appears showing `Connection successful`
- **If error**: Check that the provider URL and credentials are correct; verify the host is reachable

---

## Step 5 — Trigger synchronization

- [ ] Click **Synchroniser** in the sync status banner
- [ ] Wait for the toast: `Synchronisation lancée.`
- [ ] The sync status badge updates to **DONE** (may take a few seconds to a few minutes for large catalogs)
- **Expected**: Badge shows `DONE`; the counts show the number of movies and series added
- **If FAILED**: Check API logs for the error message

---

## Step 6 — Browse Movies

- [ ] Navigate to **Films**
- **Expected**: Movie posters/cards are displayed; no error state
- [ ] Click on a movie card
- **Expected**: Movie detail page opens with title, year (if available), synopsis, and availability badge

---

## Step 7 — Browse Series

- [ ] Navigate to **Séries**
- **Expected**: Series posters/cards are displayed
- [ ] Click on a series card
- **Expected**: Series detail page opens with title, year, synopsis, and season count

---

## Edge cases to verify manually

| Scenario | How to test | Expected outcome |
|---|---|---|
| Empty account | Use credentials for an account with no content | Sync completes with 0 movies / 0 series; pages show empty-state UI |
| Wrong password | Enter an incorrect password | Connection test returns `Server responded with HTTP 401`; no sync should be triggered |
| Very large catalog (10 000+ items) | Use a real provider with a large catalog | Sync completes (may take several minutes); movies/series pages load without error |
| Source disabled | Toggle the enable/disable switch on the source card | Source shows `Inactif` badge; sync button still works manually |
| Re-sync | Click Synchroniser a second time after content is already synced | Sync completes; existing movie/series counts update (updated count ≥ 0) |

---

## Cleanup

To reset your local database:

```bash
docker compose down -v   # removes volumes
docker compose up -d postgres
pnpm --filter @iptvflix/api db:migrate
```
