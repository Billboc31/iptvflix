Now I have everything I need. Let me write the structured review.

---

# PR Review — T002: Set up PostgreSQL persistence with Drizzle

## Résumé

Mise en place d'une couche de persistance PostgreSQL avec Drizzle ORM dans le package `apps/api`. L'implémentation couvre la connexion, les migrations, la validation d'environnement, un health check, des tests unitaires et la documentation locale. Le scope est strictement borné au ticket.

---

## Vérifications effectuées

- Lecture du plan (`runs/T002/plan.md`) et des artefacts de commit (`7970e31`)
- Lecture de tous les nouveaux fichiers : `env.ts`, `client.ts`, `health.ts`, `drizzle.config.ts`, `docker-compose.yml`, `local-dev.md`, migration SQL
- Lecture des tests : `env.test.ts`, `health.test.ts`
- Vérification du type partagé `HealthResponse` dans `packages/api-contracts`
- Vérification de la séquence de chargement dotenv → env validation → démarrage serveur

---

## Points validés

**Connexion et configuration**
- `DATABASE_URL` validée au chargement de module (`env.ts`) — le serveur ne démarre pas si la variable est absente
- Message d'erreur sanitisé : `'DATABASE_URL is not configured'` — aucune credential exposée
- `postgres.js` crée les connexions de manière lazy — un DB indisponible au démarrage ne produit pas de stacktrace avec l'URL en clair

**Drizzle ORM**
- `client.ts` : 7 lignes, lisible, aucune magie cachée
- `drizzle.config.ts` configuré correctement avec glob schema et dossier migrations
- Schéma initial `app_config` minimal et justifié comme preuve de fonctionnement des migrations

**Migrations**
- `0000_talented_shiva.sql` généré par drizzle-kit, versionné, reproductible depuis une base vide
- `_journal.json` et `0000_snapshot.json` permettent à drizzle-kit de calculer les migrations suivantes
- Scripts `db:generate`, `db:migrate`, `db:studio` documentés dans `package.json` et `local-dev.md`

**Health check**
- `SELECT 1` via `db.execute()` — probe minimal et idiomatique
- Erreur catchée proprement, réponse `{ db: 'unavailable' }` sans exposition de détails internes
- Tests mockent `db.execute` pour les deux chemins (succès et échec) sans toucher à une vraie DB

**Sécurité**
- `.env` exclus du git (`.gitignore`)
- Credentials Docker Compose locaux seulement, pas de secret en dur dans du code applicatif
- Erreurs de connexion DB ne remontent pas l'URL dans les logs (connexion lazy, erreur catchée dans health)

**Documentation**
- `docs/local-dev.md` couvre l'onboarding complet : prérequis, setup, workflow de migration, health check

---

## Problèmes détectés

### Mineur — `drizzle.config.ts` : fallback silencieux sur chaîne vide

```ts
// drizzle.config.ts
dbCredentials: {
  url: process.env.DATABASE_URL ?? '',   // ← fallback silencieux
}
```

Si `DATABASE_URL` est absent lors de l'exécution de `drizzle-kit generate` ou `drizzle-kit migrate`, l'erreur produite sera une erreur de connexion confuse plutôt qu'un message clair. Inconsistant avec la philosophie de `env.ts`. Ne bloque pas le ticket (la CLI fonctionnera si la variable est présente), mais nuit à l'expérience développeur en cas d'oubli.

### Mineur — `HealthResponse.db` sous-typé dans `api-contracts`

```ts
// packages/api-contracts/src/index.ts
export type HealthResponse = {
  status: string
  db?: string   // ← trop large, optionnel sans raison
}
```

L'implémentation retourne toujours `'ok'` ou `'unavailable'`. Le type pourrait être `db: 'ok' | 'unavailable'` (non optionnel). L'optionnalité n'est pas utilisée côté serveur et affaiblit le contrat sans raison.

### Observation — Health check retourne toujours HTTP 200

Le choix d'un status 200 même quand `db: 'unavailable'` est une décision valide pour une liveness probe, mais rend la route inutilisable comme readiness probe par un orchestrateur (Kubernetes, Docker Compose `depends_on: condition: service_healthy`). Ce n'est pas dans le scope du ticket, mais à documenter si le projet adopte un orchestrateur.

### Observation — `env.test.ts` ne couvre que le chemin d'erreur

Le test vérifie uniquement que le module lève quand `DATABASE_URL` est absent. Il n'existe pas de test positif confirmant que les exports (`DATABASE_URL`, `PORT`, `CORS_ORIGIN`) ont les bonnes valeurs quand l'environnement est correctement configuré.

---

## Risques éventuels

- **Dépendances `dotenv/config` implicites** : `env.ts` suppose que dotenv a été chargé avant lui. C'est garanti dans `index.ts` (l'import est en première ligne), mais si `env.ts` est importé directement dans un autre contexte sans dotenv préalable (futur script CLI, worker), la validation échouerait sur une variable absente. Risque faible et gérable.
- **`drizzle-kit migrate` et transactions** : drizzle-kit applique les migrations sans garantie de rollback atomique sur certaines DDL PostgreSQL. Comportement standard de l'écosystème, non spécifique à cette implémentation.

---

## Décision

Tous les critères d'acceptance du ticket T002 sont couverts :

| Critère | Statut |
|---|---|
| Connexion PostgreSQL via env | ✅ |
| Drizzle configuré et utilisable | ✅ |
| Migrations générables et applicables | ✅ |
| Base vide → schéma courant par migrations seules | ✅ |
| Échec de connexion sans exposition de credentials | ✅ |
| Tests automatisés sur le bootstrap persistance | ✅ |
| Documentation locale DB | ✅ |

Les problèmes détectés sont mineurs et n'impactent pas la fiabilité ni la sécurité de l'implémentation dans le contexte du ticket. Aucun bloquant.

IMPLEMENTATION_APPROVED
