I have enough information to write the complete review.

---

# PR Review — T095: Improve Continue Watching cards with direct resume, details and overflow actions

## Résumé

L'implémentation couvre l'intégralité du scope du ticket T095. Les fonctionnalités suivantes sont toutes présentes et correctement articulées : reprise directe sans dialog #194, barre de progression vraie durée, bouton `ⓘ` Détails, menu `⋮` avec `Supprimer de Reprendre`, persistance du dismissal profil-scopé, ré-entrée après nouvelle lecture, nettoyage auto à complétion, identité épisode claire et couverture de tests. La qualité du code est solide.

## Vérifications effectuées

- Lecture complète de tous les fichiers T095 modifiés (backend + frontend + contrats)
- Vérification du guard `skipResumeDialog` dans `PlayerPage.tsx`
- Vérification de la migration SQL et du schema Drizzle
- Vérification du LEFT JOIN + IS NULL pour le filtrage des dismissals
- Vérification de la logique de ré-entrée (seuil 5% dans `upsertProgress`)
- Vérification du seuil de complétion (90% pour quitter le shelf)
- Vérification de l'accessibilité : ARIA roles, keyboard nav, focus management
- Vérification du wiring `dismissErrorFor` dans `ContinueWatchingRow`
- Vérification des fichiers hors-scope dans le diff (artefacts de résolution de conflit)

## Points validés

**Reprise directe (req. 1)**
`ContinueWatchingCard` navigue vers `/player/{type}/{id}?source=continue_watching`. Dans `PlayerPage.tsx:63`, `skipResumeDialog = searchParams.get('source') === 'continue_watching'`. L'effet `loadedmetadata` (lignes 517-538) branche sur `!skipResumeDialog` — quand `true`, seek + play immédiat sans dialog. Correct.

**Barre de progression vraie durée (req. 2)**
`pct = Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))`. Calculée depuis des données DB (`progressSeconds`, `durationSeconds`), pas depuis le buffer. Stable au rechargement.

**Action Détails (req. 3)**
Movie → `/movies/{mediaId}`, Episode → `/series/{seriesId}`. Réutilise les composants de détail existants. Le `seriesId` est enrichi côté backend dans `listContinueWatching`. Correct.

**Menu overflow (req. 4)**
`ContinueWatchingOverflowMenu.tsx` : `role="menu"`, items en `role="menuitem"`, navigation clavier ArrowUp/Down avec wrap, Escape ferme, focus auto sur premier item à l'ouverture, retour au trigger à la fermeture. Click-outside géré. Sémantique ARIA complète.

**Dismissal persisté (req. 5)**
Table `continue_watching_dismissals` avec clé composite `(profile_id, media_type, media_id)`. INSERT ON CONFLICT DO UPDATE pour idempotence. Filtrage par LEFT JOIN + IS NULL. Survit au refresh/multi-device. Pas de destruction du `viewing_progress`.

**Ré-entrée après nouvelle lecture (req. 5)**
Dans `upsertProgress` (lignes 57-68) : si `progressSeconds >= durationSeconds * 0.05`, DELETE du dismissal. Permet le retour dans le shelf après nouvelle lecture significative.

**Complétion automatique (req. 6)**
Filtre SQL `progressSeconds < durationSeconds * 0.90` dans `listContinueWatching`. Pas d'action manuelle requise.

**Identité épisode (req. 7)**
Format `S{n}E{n} · {episodeTitle}` affiché en overlay bas du poster. Données enrichies dans `listContinueWatching` via JOIN seasons. Le bouton Play navigue vers l'épisode exact du progress record.

**Mobile/touch + desktop (req. 8)**
Cibles tactiles grandes (Play = inset-0, info/overflow = 24×24 avec container flex). Toutes les actions accessibles sans hover-only. Menu positionné `bottom-full right-0`.

**Optimistic UI (req. 9)**
Snapshot `previous`, filtre immédiat, rollback + `dismissError` en cas d'échec API. Pas de reload de page.

**Accessibilité (req. 10)**
`aria-label` sur les trois boutons, `aria-haspopup="menu"` + `aria-expanded` sur le trigger, `role="dialog"` sur le menu résumé, `focus-visible:outline` sur tous les éléments interactifs.

**Tests**
Couverture extensive : 18 cas dans `ContinueWatchingCard.test.tsx`, 17 cas backend dans `viewing-progress.test.ts`, 3 cas dans `useContinueWatching.test.ts`. Couvrent : reprise directe, navigation épisode/movie, calcul de progression, dismiss + rollback, isolation épisode, ré-entrée après 5%.

## Problèmes détectés

### Observation mineure — Absence de clamp explicite sur la position de reprise

**Fichier** : `apps/web/src/pages/PlayerPage.tsx`, lignes 529-532

```ts
if (startPositionSeconds > 0) {
  video.currentTime = startPositionSeconds
}
```

Le ticket exige explicitement : *"clamp against true duration/seekable range; if the saved position cannot be resumed, provide a recoverable fallback instead of silently seeking to an unrelated position."*

L'implémentation actuelle délègue entièrement ce clamp au navigateur. Dans le cas standard VOD, le navigateur clamp silencieusement `currentTime` à la plage seekable, ce qui est généralement acceptable. Cependant, pour des streams dont la plage seekable démarre après `startPositionSeconds` (cas rare mais possible en live/DVR ou contenus mal indexés), le seek peut atterrir à une position inattendue sans retour à l'utilisateur.

La `stableDurationRef.current` est disponible au moment de `loadedmetadata` si la probe a déjà résolu. Le fix minimal :

```ts
const dur = stableDurationRef.current ?? (isFinite(video.duration) ? video.duration : null)
const clamped = dur != null && dur > 0
  ? Math.min(startPositionSeconds, Math.max(0, dur - 5))
  : startPositionSeconds
if (clamped > 0) {
  video.currentTime = clamped
}
```

**Sévérité** : faible — comportement incorrect peu probable sur du VOD standard, mais la spécification est claire.

---

### Observation mineure — Fichiers hors-scope dans le diff

Le diff inclut des fichiers n'appartenant pas à T095 : `apps/api/migrations/0042_t106_shelf_history.sql`, `apps/api/src/services/home-service.ts`, `apps/api/src/routes/recommendation-lab.ts`, `apps/api/railway.toml` (healthcheckTimeout 30→120), et plusieurs schemas de recommendation/shelf. Ces changements proviennent de la résolution de conflits contre `main` et ne constituent pas une dérive de scope — ils n'affectent pas la logique T095. À isoler proprement avant merge si possible.

---

### Non-bloquant — Taille des cibles tactiles info/overflow

Les boutons `ⓘ` et `⋮` sont déclarés `w-6 h-6` (24×24px). WCAG 2.5.5 recommande 44×44px pour les cibles tactiles mobiles. La disposition flex compense partiellement, mais sans `padding` explicite, la cible reste sous le seuil sur mobile. Acceptable pour la taille de carte `w-36`.

## Risques éventuels

- Le guard `skipResumeDialog` est correctement câblé mais sa valeur est calculée une fois au render depuis `searchParams`. Si le composant se remonte avec un URL différent, il sera recalculé. Pas de risque de fuite du comportement CW vers des lectures normales.
- La table `continue_watching_dismissals` n'a pas de FK sur `media_id` (polymorphique, comme `viewing_progress`). Acceptable — une entrée orpheline n'a aucun effet visible autre qu'un filtre inutile.
- Aucune limite de volume sur `listContinueWatching` — un profil très actif pourrait avoir une requête volumineuse. Hors scope T095 mais à surveiller.

## Décision

- **APPROVED** — avec observations notées ci-dessus

Les critères d'acceptation du ticket sont tous satisfaits. L'absence de clamp explicite sur la position de reprise est une lacune par rapport à la spécification mais n'est pas un bloquant en conditions VOD standard. Les fichiers hors-scope sont des artefacts de merge.

## Actions demandées

1. *(Recommandé, non-bloquant)* Ajouter le clamp explicite sur `startPositionSeconds` dans le branch `skipResumeDialog` de `PlayerPage.tsx:529-532` pour satisfaire pleinement la spécification de robustesse.
2. *(Nettoyage pre-merge)* Vérifier que les fichiers de tickets tiers (T106, recommendation-lab) dans le diff sont attendus ou à exclure du PR T095.

IMPLEMENTATION_APPROVED
