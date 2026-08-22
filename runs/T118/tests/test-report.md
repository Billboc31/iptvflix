---

## Rapport de validation — T118

**Résultat : ✅ VALIDÉ**

### Tests automatisés

```
Test Files  2 passed (2)
Tests       14 passed (14)
```

Tous les tests spécifiques à T118 passent (client preview + route API).

### Critères d'acceptation

| Critère | Statut |
|---------|--------|
| AC1 — UI n'affiche plus "Recommendation engine unavailable" | ✅ PASS |
| AC2 — Logs permettent de distinguer 404 / 500 / timeout / réseau | ✅ PASS |
| AC3 — Timeout dédié `RECOMMENDATION_PREVIEW_TIMEOUT_MS` (45 s défaut) | ✅ PASS |
| AC4 — Chemin nominal non coupé à 15 s (test avec réponse à 20 s) | ✅ PASS |
| AC5 — Aucun secret dans les logs ou réponses | ✅ PASS |

### Points vérifiés en détail

- **Client** (`recommendation-engine-client.ts` l.274-320) : union discriminante `EnginePreviewResult` avec `kind` in `{not-found, server-error, timeout, unreachable, circuit-open}`. Logs structurés avec `endpoint`, `status`, `durationMs`, `kind`, corps tronqué à 500 chars. Aucun header loggé.
- **Route** (`shelf-concepts.ts` l.91-119) : mapping exhaustif → 404 / 504 / 503 / 502 avec messages distincts.
- **Frontend** (`api.ts` l.112-114) : extrait `parsed.error` du JSON et le passe en `toast.show()`.
- **Timeout** : `fetchWithTimeout()` prend un paramètre optionnel ; preview utilise `RECOMMENDATION_PREVIEW_TIMEOUT_MS`, les autres endpoints restent à 15 s.

### Limites non-bloquantes

- Pas de test e2e contre le recommendation-engine réel (couvert par mocks ; la détection en prod est assurée par les logs et le code 404 explicite).
- Health/version endpoint non implémenté (ticket : "éventuellement").

Rapport écrit dans `runs/T118/tests/tester-report.md`.
