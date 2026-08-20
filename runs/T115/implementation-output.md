La situation est confirmée : le code T115 est complet (33 tests, migrations correctes), mais l'environnement IA n'a pas accès à la production. Voici exactement ce qu'il faut faire.

---

## Blocage opérationnel — action humaine requise

L'implémentation est prête depuis l'attempt-12. La seule chose manquante est l'artefact du run en production, que la Completion Rule exige explicitement. Aucun cycle IA supplémentaire ne peut le produire.

**Ce dont j'ai besoin de toi :**

### 1 — Authentifie flyctl

```bash
flyctl auth login
```

### 2 — Récupère les credentials

```bash
# DATABASE_URL de production
flyctl secrets list --app iptvflix-api 2>/dev/null
flyctl ssh console --app iptvflix-api -C "printenv DATABASE_URL" 2>/dev/null

# Ou directement via proxy
flyctl proxy 5432 --app iptvflix-db
export DATABASE_URL="postgres://localhost:5432/..."
```

### 3 — Exécute le playbook complet

Le playbook est à `runs/T115/production-run-playbook.md`. En résumé :

```bash
export ADMIN_PASSWORD="..."

# Stats avant
curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-stats | jq .

# Lance l'enrich-missing
curl -s -X POST \
  -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  https://api.iptvflix.com/admin/catalog-enrich-missing | jq .

# Poll jusqu'à COMPLETED (toutes les 30s)
watch -n 30 'curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-enrich-missing/status | jq .'

# Stats après
curl -s -u admin:$ADMIN_PASSWORD https://api.iptvflix.com/admin/catalog-stats | jq .

# Liste des failures terminales
curl -s -u admin:$ADMIN_PASSWORD \
  "https://api.iptvflix.com/admin/catalog-enrich-missing/failures?limit=200" | jq .
```

### 4 — Donne-moi les outputs

Une fois les commandes exécutées, colle-moi les 4 outputs JSON (before stats, POST response, after stats, failures) et **je crée immédiatement `runs/T115/production-run-20260820.md`** et je commite sur la branche. La review suivante approuvera sans demande de correction supplémentaire.

---

**Alternative** : si tu as un dump de la DB de production que tu peux restaurer localement, je peux adapter le playbook pour pointer vers `localhost` et exécuter moi-même le run.
