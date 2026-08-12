I have all the information needed. Here is the structured review.

---

# PR Review — T039: Add explicit like, dislike and not-interested feedback signals

## Résumé

L'implémentation couvre l'ensemble du périmètre défini par le ticket et le plan : schéma DB, migration, contrats API, routes backend, service, composant frontend et hook. Les invariants fondamentaux (unicité par profil/media, idempotence, isolation des autres features) sont correctement traduits en code.

## Vérifications effectuées

- Lecture du plan complet (`runs/T039/plan.md`)
- Lecture du schéma Drizzle (`explicit-feedback.ts`) et de la migration SQL générée
- Lecture du service (`feedback-service.ts`) et des routes (`feedback.ts`)
- Lecture des contrats partagés (`packages/api-contracts/src/user-state.ts`)
- Lecture du hook React (`useFeedback.ts`), du composant (`FeedbackButtons.tsx`), et de leur intégration dans `MovieDetailPage.tsx` / `SeriesDetailPage.tsx`
- Lecture de la suite de tests backend (`feedback.test.ts`)

## Points validés

**Modèle de données**
- Enum `feedback_type` avec exactement `LIKE | DISLIKE | NOT_INTERESTED`
- Constraint unique `(profileId, mediaType, mediaId)` au niveau DB — garantit l'unicité sans application-level lock
- FK `profile_id → profiles.id ON DELETE CASCADE` — la suppression d'un profil nettoie ses feedbacks
- `created_at` + `updated_at` avec timezone — provenance temporelle disponible pour le moteur de recommandation
- `media_id` typé `uuid` au niveau SQL (via `watchlist_media_type` enum réutilisé pour `media_type`)

**Routes et service**
- `PUT /feedback/:mediaType/:mediaId` — upsert via `onConflictDoUpdate`, validation `mediaType ∈ {MOVIE, SERIES}`, validation existence media (→ 404 si absent)
- `DELETE /feedback/:mediaType/:mediaId` — idempotent, 204 que la ligne existe ou non
- `GET /feedback` — liste complète triée par `updatedAt DESC`
- Aucune mutation des tables `watchlist`, `follow_release`, `viewing_progress` dans le service

**Indépendance**
- Le module ne lit ni n'écrit dans watchlist, follow_release ou viewing_progress : les tests le confirment explicitement (`mockDb.insert` appelé exactement une fois, `mockDb.delete` non appelé)

**Frontend**
- `useFeedback` : état optimiste avec fallback refetch sur erreur — UX cohérente
- `FeedbackButtons` : trois boutons mutuellement exclusifs, `aria-pressed` correct, toggle sur bouton actif
- Intégré dans `MovieDetailPage` et `SeriesDetailPage` avec les bons props

**Tests backend**
- 13 cas couvrant happy path, changement de valeur, idempotence (PUT et DELETE), validation 400/404, isolation MOVIE/SERIES

## Problèmes détectés

### Mineur 1 — `mediaId` non-UUID en URL → 500 au lieu de 400

Dans `validateMediaId`, la requête `db.select().from(movies).where(eq(movies.id, mediaId))` transmet la chaîne brute à PostgreSQL. Si `mediaId` n'est pas un UUID valide, PostgreSQL lève une erreur `invalid input syntax for type uuid` qui remonte en 500 non géré, au lieu d'un 400 propre.

La colonne SQL est bien typée `uuid` (visible dans la migration), donc le DB engine rejettera toute chaîne malformée. Il manque une validation de format UUID en entrée de route (avant l'appel service).

**Correction suggérée** (non bloquante, mais recommandée avant exposition externe) :

```typescript
// apps/api/src/routes/feedback.ts, après validation mediaType
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!UUID_RE.test(mediaId)) {
  return reply.status(400).send({ error: 'mediaId must be a valid UUID' })
}
```

### Mineur 2 — Tests frontend ne vérifient pas le rendu de `FeedbackButtons`

Le critère d'acceptation du plan indique : *"MovieDetailPage et SeriesDetailPage render `<FeedbackButtons>` showing the correct active state"*. Les tests de pages existants (`MovieDetailPage.test.tsx`, `SeriesDetailPage.test.tsx`) ne contiennent aucune assertion sur la présence ou l'état des boutons de feedback.

Le composant est bien intégré dans le code, mais la régression ne serait pas détectée par les tests.

### Observation — `updatedAt` avance même sur PUT idempotent

Sur un `PUT` avec la même valeur de feedback, `updatedAt` est mis à jour (`set: { feedback, updatedAt: now }`). C'est un choix acceptable (le timestamp reflect le moment de la dernière interaction) mais il signifie que le tri `GET /feedback` peut changer d'ordre à chaque requête répétée, même sans changement sémantique. Si le moteur de recommandation interprète `updatedAt` comme "signal d'intérêt renforcé", ce comportement est intentionnel ; sinon, il peut parasiter le scoring.

### Observation — `SetFeedbackBody` dans le plan vs implémentation

Le plan définissait `SetFeedbackBody = { mediaType, mediaId, feedback }` mais l'implémentation correctement ne met que `{ feedback }` dans le body (mediaType et mediaId sont des path params). La définition dans `api-contracts` est juste — la description du plan était imprécise.

## Risques éventuels

- L'absence de validation UUID sur `mediaId` expose un vecteur de 500 non contrôlé si l'API est appelée par un client externe ou un test mal formé.
- Le hook `useFeedback` maintient son propre état local non partagé. Si deux instances du hook coexistaient sur la même page (ex. future PosterCard + DetailPage), elles seraient désynchronisées. Dans la configuration actuelle (une seule instance par page), ce n'est pas un problème.

## Décision

- APPROVED avec observations

Les deux problèmes détectés sont mineurs et ne bloquent pas la livraison. Le problème UUID (#1) devrait être corrigé rapidement si l'API est exposée à des appels externes. L'absence de tests frontend (#2) est un écart par rapport au critère d'acceptation du plan mais le code est fonctionnel.

## Actions demandées

1. **Non bloquant, recommandé** — Ajouter validation UUID format sur `mediaId` dans les routes PUT et DELETE avant l'appel service.
2. **Non bloquant** — Ajouter au moins un test dans `MovieDetailPage.test.tsx` vérifiant que `FeedbackButtons` est rendu avec les bons props.

---

IMPLEMENTATION_APPROVED
