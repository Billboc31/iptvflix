Maintenant j'ai tout le contexte nécessaire. Voici la situation réelle :

---

## Coder-attempt-26 — Escalade vers l'opérateur humain

**Aucun changement de code. L'implémentation est complète.**

### État actuel

- **33 tests passent** — vérifié à l'instant (23:24:37)
- **`flyctl` est installé** (`/opt/homebrew/bin/flyctl`) mais pas authentifié
- **`api.iptvflix.com`** n'est pas joignable depuis cet environnement
- **Le workflow IA est en boucle depuis l'attempt-24** — chaque review marque `IMPLEMENTATION_FIX_REQUIRED` parce que la production n'a pas été touchée, mais il n'y a aucun code à corriger

### Ce que tu dois faire pour débloquer le ticket

**Étape 1 — Authentification Fly.io** (2 minutes)

```bash
flyctl auth login
```

Cela ouvre le navigateur pour te connecter. Une seule fois suffit.

**Étape 2 — Déployer la branche sur production** (ou tunnel DB)

```bash
# Option A — déployer le code sur prod
git checkout ticket/T115-complete-catalog-enrichment-and-make-refresh-failu
flyctl deploy --app <ton-app-api>

# Option B — pointer l'API locale sur la DB de production
flyctl proxy 5432 -a <ton-app-postgres>
# Puis lancer le serveur local avec DATABASE_URL=postgres://localhost:5432/...
```

**Étape 3 — Exécuter le playbook** — le playbook complet est à `runs/T115/production-run-playbook.md`

```bash
ADMIN_PASSWORD=xxx API=https://api.iptvflix.com

# Before stats
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats | jq .

# Start enrichment run
curl -s -X POST -u admin:$ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 50, "concurrency": 3, "throttleMs": 500}' \
  $API/admin/catalog-enrich-missing | jq .

# Poll until COMPLETED
watch -n 30 "curl -s -u admin:\$ADMIN_PASSWORD $API/admin/catalog-enrich-missing/status | jq ."

# After stats + terminal failures
curl -s -u admin:$ADMIN_PASSWORD $API/admin/catalog-stats | jq .
curl -s -u admin:$ADMIN_PASSWORD "$API/admin/catalog-enrich-missing/failures?limit=200" | jq .
```

**Étape 4 — Créer le rapport** `runs/T115/production-run-20260820.md` avec les stats avant/après et la liste des 126 failures avec leurs vraies causes.

### Pourquoi le workflow IA ne peut pas le faire

Le workflow identifie correctement que la "Completion Rule" n'est pas satisfaite, mais ne peut pas y remédier lui-même — Fly.io nécessite une authentification OAuth interactive. Le code, les migrations, les routes, les stats et le playbook sont prêts depuis l'attempt-12. Les 12+ cycles suivants n'ont rien pu ajouter.

**Le seul débloquant : toi, avec `flyctl auth login`.**
