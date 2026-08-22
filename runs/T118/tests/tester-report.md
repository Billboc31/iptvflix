# T118 — Rapport de validation Tester

**Date**: 2026-08-22  
**Branch**: ticket/T118-diagnostiquer-et-fiabiliser-la-preview-shelfconcep  
**Résultat global**: ✅ VALIDÉ

---

## Résumé des tests automatisés

```
Test Files  2 passed (2)
Tests       14 passed (14)
Duration    376ms
```

Fichiers testés :
- `apps/api/src/client/__tests__/recommendation-engine-client-preview.test.ts` — 6 tests
- `apps/api/src/routes/__tests__/shelf-concepts-preview.test.ts` — 8 tests

---

## Critères d'acceptation

### AC1 — L'UI n'affiche plus systématiquement `Recommendation engine unavailable`
**Statut : ✅ PASS**

La route retourne des messages distincts selon le cas :
- 404 → `"Recommendation preview endpoint not deployed"`
- 504 → `"Recommendation preview timed out"`
- 503 → `"Recommendation engine circuit open"`
- 502 → `"Recommendation engine error (HTTP <status>)"` ou `"Recommendation engine unreachable"`

Le frontend (`apps/web/src/lib/api.ts` l.112-114) extrait `parsed.error` depuis le JSON et le transmet via `ApiError.message`, affiché dans le toast (`RecommendationLabPage.tsx` l.391).

Test couvrant spécifiquement ce critère : _"error messages are different from the previous generic 'Recommendation engine unavailable'"_ ✅

---

### AC2 — Les logs permettent de savoir immédiatement si le problème est un 404, un 500, un timeout ou une erreur réseau
**Statut : ✅ PASS**

Chaque branche d'erreur logue au minimum :
- `endpoint` (URL complète)
- `status` (code HTTP, si applicable)
- `durationMs`
- `kind` (`'not-found'`, `'server-error'`, `'timeout'`, `'unreachable'`)
- `body` tronqué à 500 caractères (réponses HTTP) ou `error` (message réseau)

Aucun header, token, secret ou clé API n'est loggé. Vérification manuelle du code confirmée.

---

### AC3 — La preview dispose d'un timeout adapté au coût du pipeline complet
**Statut : ✅ PASS**

- Env var `RECOMMENDATION_PREVIEW_TIMEOUT_MS` ajoutée dans `apps/api/src/config/env.ts` l.104 (défaut : 45 s)
- `fetchWithTimeout()` appelée avec `RECOMMENDATION_PREVIEW_TIMEOUT_MS` dans `previewShelfConcept()`, vs le `REQUEST_TIMEOUT_MS = 15_000` utilisé par les autres endpoints
- Les endpoints légers conservent leur timeout de 15 s

---

### AC4 — Le chemin nominal fonctionne sans être coupé à 15 secondes
**Statut : ✅ PASS**

Test explicite : _"resolves successfully when engine responds after 20 s (above old 15 s default, below 45 s preview timeout)"_

Ce test simule une réponse après 20 s et vérifie que le résultat est `{ ok: true, data }`. ✅

---

### AC5 — Aucun secret n'est exposé dans les logs ou réponses utilisateur
**Statut : ✅ PASS**

- Les logs ne contiennent que : endpoint, status, durationMs, kind, body tronqué
- Aucun header (`Authorization`, etc.) n'est loggé ni transmis côté client engine
- Les réponses d'erreur API ne contiennent que le champ `{ error: "..." }` (pas de stacktrace ni de corps brut du moteur)

---

## Travaux demandés — vérification détaillée

| # | Travail | Statut |
|---|---------|--------|
| 1.1 | Ne plus avaler silencieusement les erreurs | ✅ |
| 1.2 | Logger endpoint, status, durée, timeout/réseau, body tronqué | ✅ |
| 1.3 | Ne jamais logger secrets/headers | ✅ |
| 1.4 | Type d'erreur structuré `EnginePreviewResult` discriminant les cas | ✅ |
| 2.1 | Timeout dédié pour preview (pas le global 15 s) | ✅ |
| 2.2 | Config `RECOMMENDATION_PREVIEW_TIMEOUT_MS` (défaut 45 s) | ✅ |
| 2.3 | Timeout global 15 s conservé pour endpoints légers | ✅ |
| 2.4 | Timeout reporté explicitement (`kind:'timeout'`) | ✅ |
| 3.1 | 404 engine → 404 API "not deployed" | ✅ |
| 3.2 | Timeout → 504 "timed out" | ✅ |
| 3.3 | 5xx engine → 502 avec status | ✅ |
| 3.4 | Réseau → 502 "unreachable" | ✅ |
| 3.5 | Frontend affiche le message précis | ✅ |
| 4.1 | Test vérifiant l'URL `/v1/shelf-concepts/:id/preview` | ⚠️ partiel (mocks, pas de test e2e contre le vrai recommendation-engine) |
| 4.2 | API appelle exactement la bonne base URL + chemin | ✅ |
| 4.3 | Health/version endpoint | — (non implémenté, "éventuellement" dans le ticket) |
| 5.1 | Test client 404 → `not-found` | ✅ |
| 5.2 | Test client 500 → `server-error` | ✅ |
| 5.3 | Test client AbortError → `timeout` | ✅ |
| 5.4 | Test route : timeout→504, 5xx→502, réseau→502 | ✅ |
| 5.5 | Test nominal >15 s et <45 s | ✅ |

---

## Anomalies et limites

### ⚠️ Limite (non bloquante) — Pas de test d'intégration e2e contre le recommendation-engine réel

Le ticket demande de _"garantir que `/v1/shelf-concepts/:id/preview` est enregistrée par le recommendation-engine"_. L'implémentation couvre cela uniquement par tests unitaires avec mocks. Un test d'intégration contre le service réel n'existe pas, mais cela sort du périmètre des tests unitaires d'API et nécessiterait un environnement déployé.

**Impact** : faible — la cause hypothèse 1 (route 404) est désormais détectable en production grâce aux logs et codes d'erreur précis.

### ⚠️ Limite (non bloquante) — Health/version endpoint absent

Le ticket mentionnait "éventuellement" un endpoint de version. Non implémenté, cohérent avec la formulation optionnelle.

---

## Conclusion

L'implémentation satisfait tous les critères d'acceptation bloquants. Les 14 tests passent. Les deux limites identifiées sont non-bloquantes et alignées avec la formulation optionnelle du ticket.

**Recommandation** : ✅ VALIDÉ — prêt pour review.
