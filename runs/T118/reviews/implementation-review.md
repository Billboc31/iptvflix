## Review — T118

**Décision : IMPLEMENTATION_APPROVED**

### Points validés

**Observabilité** — `previewShelfConcept()` ne retourne plus jamais `null`. Logs structurés sur tous les chemins : `{ endpoint, status, durationMs, kind, body }`. Body tronqué à 500 chars, aucun header logué. ✅

**Timeout dédié** — `RECOMMENDATION_PREVIEW_TIMEOUT_MS` (défaut 45 s) correctement isolé via le paramètre optionnel de `fetchWithTimeout`. Les autres méthodes conservent leurs 15 s. Test fake-timers à 20 s confirme le comportement. ✅

**Mapping HTTP** — Les 5 kinds (`not-found` → 404, `timeout` → 504, `circuit-open` → 503, `server-error` → 502, `unreachable` → 502) sont correctement implémentés avec des messages distincts de l'ancien générique. ✅

**Tests** — 14 tests (6 client + 8 route), tous les cas du ticket couverts. ✅

**Sécurité** — Aucun secret, aucun header dans les logs. ✅

### Dépassements de scope (non-bloquants, justifiés)

- **Route engine ajoutée** — le plan l'excluait, mais l'hypothèse #1 du ticket était précisément "la route n'existe pas encore". L'ajout adresse la cause racine.
- **Changements frontend** — le planifier pensait qu'aucune modification n'était nécessaire, mais le frontend appelait encore l'ancienne `semanticQuery` au lieu du nouvel endpoint preview. La correction était indispensable.
- Tests de régression T117 injectés dans `pipeline-regression.test.ts` — hors scope mais bénins.

### Observations mineures

- Pas de test `app.inject()` côté engine pour valider l'enregistrement de la route (demandé au point 4 du ticket, non bloquant car la route est dans le code).
- `unreachable` retourné quand `RECOMMENDATION_ENGINE_URL` est absent — sémantique légèrement imprécise mais comportement cohérent avec le reste du client.
