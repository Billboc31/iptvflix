The situation is clear. This workflow has been looping since attempt-12. The code is complete, the tests pass, and the only remaining blocker is a production run that requires your Fly.io credentials — which no AI agent can provide.

Here's the current state and exactly what breaks the loop:

---

## Situation : boucle sur attempt-30

**Code** : complet depuis attempt-12. 33 tests. Migrations 0047/0048. Aucun changement de code n'est nécessaire.

**Blocage** : la Completion Rule du ticket T115 exige un run contre la production réelle (~60k films / ~5k séries). L'artefact `production-run-20260820.md` avec des données réelles n'existe pas.

**Pourquoi ça loop** : le reviewer détecte l'absence de données production → `IMPLEMENTATION_FIX_REQUIRED` → le coder redémarre → same output → repeat.

---

## Ce que tu dois faire (toi, pas un agent)

Tu as **3 options** pour briser la boucle :

### Option A — Run contre la production (recommandé)

```bash
# 1. Récupère l'URL admin
export ADMIN_PASSWORD="<ton password admin>"
export API="https://api.iptvflix.com"

# 2. Stats avant
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats | jq . > /tmp/before.json

# 3. Lance l'enrichissement
curl -s -X POST \
  -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  $API/admin/catalog-enrich-missing | jq .

# 4. Poll jusqu'à COMPLETED
watch -n 30 'curl -s -u admin:$ADMIN_PASSWORD '$API'/admin/catalog-enrich-missing/status | jq .'

# 5. Stats après + failures
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats | jq . > /tmp/after.json
curl -s -u admin:$ADMIN_PASSWORD "$API/admin/catalog-enrich-missing/failures?limit=200" | jq . > /tmp/failures.json
```

**Colle-moi les 3 fichiers JSON** → je crée immédiatement `runs/T115/production-run-20260820.md` et commit.

### Option B — Restore DB locale

Si tu as un dump de la prod :

```bash
pg_restore -d postgres://localhost:5432/iptvflix_prod dump.pg
export DATABASE_URL="postgres://localhost:5432/iptvflix_prod"
```

Dis-moi que la DB locale est prête → je lance les commandes moi-même.

### Option C — Accepter le run local comme suffisant

Si tu considères que le run de dev du 2026-08-19 (6 films, démonstration des failure paths) suffit pour satisfaire le ticket, dis-le moi explicitement. Je mets à jour le `state.json` en `IMPLEMENTATION_APPROVED` et je commit. La review suivante le marquera comme accepté.

---

**Quelle option tu choisis ?** Si tu vas faire l'Option A maintenant, je génère aussi le template du fichier rapport pendant que tu prépares les commandes.
