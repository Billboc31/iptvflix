La situation est claire et je ne vais pas démarrer un nouveau cycle de code. Voici l'état actuel après 31 tentatives :

---

## Situation — Boucle brisée, intervention humaine requise

**Code : complet depuis attempt-12.** 33 tests passent. Migrations 0047/0048 en place. Aucun changement de code n'est nécessaire.

**Blocage unique** : la Completion Rule du ticket T115 exige un run contre la production réelle. L'IA ne peut pas exécuter ce run (credentials Fly.io requis).

---

## Tu dois choisir une option

### Option A — Run production (recommandé)

```bash
export ADMIN_PASSWORD="<ton password admin>"
export API="https://api.iptvflix.com"

# Stats avant
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats | jq . > /tmp/before.json

# Lancer l'enrichissement
curl -s -X POST \
  -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  $API/admin/catalog-enrich-missing | jq .

# Attendre COMPLETED (poll toutes les 30s)
watch -n 30 'curl -s -u admin:$ADMIN_PASSWORD '$API'/admin/catalog-enrich-missing/status | jq .'

# Stats après + failures
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats | jq . > /tmp/after.json
curl -s -u admin:$ADMIN_PASSWORD "$API/admin/catalog-enrich-missing/failures?limit=200" | jq . > /tmp/failures.json
```

Colle-moi les 3 fichiers JSON → je crée `runs/T115/production-run-20260820.md` et commit immédiatement.

---

### Option B — DB locale avec dump prod

Si tu as un dump : restaure-le localement et dis-moi que la DB est prête. Je lance les commandes moi-même.

---

### Option C — Accepter le run local comme suffisant

Si le run dev du 2026-08-19 (6 films, démonstration des failure paths) est suffisant pour toi, dis-le **explicitement**. Je mets à jour le state en `IMPLEMENTATION_APPROVED` sans autre cycle.

---

**Quelle option tu choisis ?**
