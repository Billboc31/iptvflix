I have reviewed the full implementation. Here is the structured review.

---

# PR Review — T052 — Surface followed-media arrivals

## Résumé

Implémentation d'une inbox d'arrivées durables par profil, exposée via REST API et surfacée sur la HomePage (rayon "Nouveautés disponibles") et une page dédiée `/arrivals`. Couvre la totalité des critères d'acceptation du ticket.

## Vérifications effectuées

- Schema SQL + Drizzle schema (`media_arrivals`, contrainte unique `(profile_id, release_event_id)`, FK correctes)
- Intégration dans `recordReleaseEvent` (appel conditionné à un vrai insert + `SOURCE_APPEARED` + type `MOVIE|SERIES`)
- Service `arrival-service.ts` : `recordArrivalsForFollowers`, `listArrivals`, `markRead`
- Routes API (`GET /arrivals`, `PATCH /arrivals/:id/read`)
- Contrats partagés (`ArrivalItem`)
- Hook React `useArrivals`, composant `ArrivalCard`, pages `ArrivalsPage` et `HomePage`
- Routage `App.tsx` et navigation `LeftNav`
- Tests d'intégration service (real DB) et tests de routes (mocked)

## Points validés

- **Idempotence garantie** : `ON CONFLICT DO NOTHING` sur `(profileId, releaseEventId)` + `recordReleaseEvent` qui ne déclenche `recordArrivalsForFollowers` que sur `inserted.length > 0` — double verrouillage correct.
- **Réapparition** : un nouveau `SOURCE_APPEARED` après `SOURCE_DISAPPEARED` génère un `releaseEventId` distinct → nouvelle arrivée correcte.
- **Scope médias** : le filtre `mediaType === 'MOVIE' || mediaType === 'SERIES'` dans `recordReleaseEvent:43` exclut correctement les épisodes.
- **Ownership check** : `markRead` vérifie `profileId + arrivalId` avant d'updater — pas d'IDOR possible.
- **Tests** : tous les cas du plan sont couverts — première arrivée, sync idempotente, unfollowed media, markRead, disappear/reappear.
- **Frontend** : liens vers les pages de détail médias corrects (`/movies/:id`, `/series/:id`), dismiss déclenche un refresh, `useArrivals` annule proprement les requêtes en vol (`cancelled = true`).
- **Persistance** : stockage DB — survit aux redémarrages.
- **Scope strict** : aucune notification push, email ou WebSocket introduite.

## Problèmes détectés

### Mineurs (non bloquants)

1. **Type mismatch `onDismiss` dans `HomePage.tsx:69`**
   ```tsx
   onDismiss={refreshArrivals}  // () => void
   // ArrivalCard attend: onDismiss?: (id: string) => void
   ```
   TypeScript accepte car la compatibilité structurelle autorise une fonction avec moins de paramètres. Fonctionnellement correct (le refresh global est la bonne sémantique pour la home). Non bloquant.

2. **`ArrivalListResponse` omis** : le plan mentionnait un wrapper `{ arrivals: ArrivalItem[] }`, mais l'implémentation retourne `ArrivalItem[]` directement — cohérent avec les autres endpoints, plus simple. Non bloquant.

3. **Dismiss silencieux** : `markArrivalRead(...).catch(() => {})` dans `ArrivalCard:27` — une erreur réseau sur le dismiss ne donne aucun feedback à l'utilisateur. Acceptable pour une opération de confort, mais à noter.

## Risques éventuels

Aucun risque identifié sur la sécurité, l'intégrité des données ou les régressions sur les fonctionnalités existantes. La modification de `release-lifecycle-service.ts` est chirurgicale (3 lignes ajoutées après le `insert`, sans toucher aux autres branches).

## Décision

Implémentation conforme au ticket, au plan, aux conventions du projet. Tous les critères d'acceptation sont satisfaits. Les observations sont mineures et ne justifient pas un cycle de correction.

IMPLEMENTATION_APPROVED
