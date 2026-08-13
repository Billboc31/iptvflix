# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T050 — Add secure Web playback flow from selected Availability

**Source**: GitHub Issue #99

## Description

## Objective

Allow a user to start actual Movie/Episode playback from the Web app using the backend-selected Availability while keeping provider-specific playback details and credentials contained as safely as possible.

## Context / Problem

IPTVFlix can now normalize multiple source/language/quality variants and deterministically select the preferred Availability, but actual playback was intentionally deferred. A hosted Web test should support the complete flow from Media detail/recommendation to Play.

Xtream/M3U playback references may contain sensitive source credentials. The implementation must not simply expose stored provider secrets through generic catalog APIs or logs.

## Included

- Add a backend playback-resolution boundary that accepts canonical Movie/Episode identity (and optional explicit availability choice) and revalidates the requested Availability server-side.
- Reuse the existing profile best-availability resolver for default playback selection.
- Resolve provider-specific playback information inside the provider/availability layer for Xtream and any already-supported provider where practical.
- Define an explicit playback descriptor/session contract for clients; avoid adding raw credentials to general Media/Availability DTOs.
- Add a Web player experience with play/resume, basic loading/error states and manual variant selection when alternatives exist.
- Integrate viewing-progress updates with the existing profile progress/Continue Watching model.
- Ensure unavailable/stale/disabled-source variants cannot be launched.
- Avoid logging credential-bearing playback URLs/tokens.
- Design the contract so Android TV/Media3 can consume the same backend playback resolution later.

## Acceptance Criteria

- [ ] Clicking Play on a playable Movie resolves and starts the profile-preferred currently available variant.
- [ ] A playable Episode can be launched from the Series/Episode experience.
- [ ] The user can explicitly choose another valid availability/variant when alternatives exist.
- [ ] Disabled, stale or unavailable variants are rejected server-side even if the client submits their ids.
- [ ] Provider secrets are not added to general catalog/detail responses or logs.
- [ ] Playback progress updates the existing Continue Watching state and resume starts from stored progress where supported.
- [ ] Playback-resolution failures produce a usable UI error rather than exposing provider internals.
- [ ] Tests cover preferred selection, explicit variant, invalid/stale availability, progress and secret redaction.

## Excluded / Out of scope

- DRM-protected commercial streaming providers.
- Adaptive transcoding infrastructure.
- Full Android TV player implementation.
- Live TV.

## Dependencies

Requires the existing Availability resolver and should depend on #95 for a public hosted deployment so playback/source endpoints are not anonymously exposed.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Implementation complete. Here's a summary of all files created or modified:

---

## Files created

**API contracts**
- `packages/api-contracts/src/playback.ts` — `PlaybackResolveRequest` and `PlaybackSessionResponse` types; `streamUrl` kept isolated from all catalog DTOs
- `packages/api-contracts/src/index.ts` — added `export * from './playback.js'`

**Provider URL builders**
- `apps/api/src/providers/xtream/playback.ts` — `buildXtreamStreamUrl` (no logging of credentials)
- `apps/api/src/providers/m3u/playback.ts` — `buildM3UStreamUrl` (pass-through of stored URL)

**Backend service & route**
- `apps/api/src/services/playback-resolver.ts` — `resolvePlayback(profileId, mediaType, mediaId, explicitAvailabilityId?)`: loads availabilities, filters by enabled sources, delegates to `resolveVariant` or validates explicit ID, fetches resume progress, dispatches to Xtream/M3U URL builders; never logs `streamUrl`
- `apps/api/src/routes/playback.ts` — `POST /playback/resolve/:mediaType/:mediaId` behind `authenticate`; maps typed errors to 400/403/404; no provider internals in responses
- `apps/api/src/index.ts` — registered `playbackRoutes` in the protected scope

**Web frontend**
- `apps/web/src/hooks/usePlayback.ts` — resolves playback session on mount, exposes `switchVariant`
- `apps/web/src/hooks/useProgressSync.ts` — debounced (10s) `timeupdate` + `ended` progress sync
- `apps/web/src/pages/PlayerPage.tsx` — full-screen `<video>`, HLS via `hls.js` if `.m3u8`, resume from `startPositionSeconds`, variant selector overlay
- `apps/web/src/lib/api.ts` — added `resolvePlayback()`
- `apps/web/src/App.tsx` — added `/player/:mediaType/:mediaId` route (protected, no AppShell)
- `apps/web/src/pages/MovieDetailPage.tsx` — added **▶ Lecture** button when `availabilityStatus === 'AVAILABLE'`
- `apps/web/src/components/detail/EpisodeRow.tsx` — added **▶ Lire** button per available episode

**Tests**
- `apps/api/src/services/__tests__/playback-resolver.test.ts` — 17 tests covering preferred selection, explicit variant (valid/invalid/disabled), resume position, M3U URL shape, Xtream URL shape, secret non-logging, and no-candidate error paths

**Result:** `tsc --noEmit` clean on both packages; `vitest run` — 44 test files, 623 tests, all green.

---

## Review

I have enough information to write the full review.

---

## PR Review — T050: Secure Web Playback Flow from Selected Availability

### Résumé

L'implémentation couvre l'ensemble des exigences du ticket : endpoint de résolution `/playback/resolve/:mediaType/:mediaId` protégé par JWT, isolation des credentials Xtream/M3U dans les URL de stream, validation server-side des variantes, 17 tests unitaires, page player Web avec reprise de position et sélection de variante, et intégration du suivi de progression. La grande majorité du code est correcte et bien structurée — il y a cependant un bug de cleanup HLS qui impacte directement le critère d'acceptation de changement de variante, et un cas de type source non géré qui peut provoquer un comportement silencieux inattendu.

---

### Vérifications effectuées

- Plan vs. implémentation : tous les fichiers listés dans le plan ont été produits
- Sécurité : isolation des credentials, absence de `streamUrl` dans les DTOs catalogue, réponses d'erreur sans détails provider
- Validation server-side : status UNAVAILABLE → 400, source disabled → 403, ID inconnu → 404, tous mappés à `'Variant not available'` côté client
- Enregistrement des routes dans le scope protégé (JWT `authenticate` hook)
- Frontend : routing, usePlayback, useProgressSync, PlayerPage
- Tests : couverture des 7 scénarios requis par le plan
- Type contracts : `PlaybackSessionResponse` et `AvailabilityVariantResponse` n'exposent aucun champ credential

---

### Points validés

- `POST /playback/resolve/:mediaType/:mediaId` correctement enregistré dans `protectedScope` (`apps/api/src/index.ts:92`)
- `streamUrl` absent de tous les DTOs catalogue ; `PlaybackSessionResponse` est un contrat isolé dans `packages/api-contracts/src/playback.ts`
- `alternatives: AvailabilityVariantResponse[]` ne contient ni `providerItemId` ni `streamUrl`, uniquement des métadonnées de variante
- Le resolver revalide toujours côté serveur même si le client fournit un `availabilityId` explicite — le chemin "explicit ID not in candidates" lève bien un `NotFoundError` via `allRows.find(...)` avant d'accéder à `candidates`
- Les 3 catégories d'erreur sont mappées à des messages génériques sans internals provider dans `apps/api/src/routes/playback.ts:37-46`
- Le logger Fastify (pino) n'est jamais appelé avec `streamUrl` dans le service ni les URL builders — test `secret redaction` vérifié
- `useProgressSync` : debounce 10 s sur `timeupdate`, envoi final sur `ended`, listeners correctement retirés au cleanup
- Bouton Play Movie conditionnel à `availabilityStatus === 'AVAILABLE'` (`MovieDetailPage.tsx:221`)
- Bouton Lire Episode conditionnel à `!isUnavailable` (`EpisodeRow.tsx:46`)
- Route `/player/:mediaType/:mediaId` enregistrée sans AppShell dans `App.tsx:31`
- `hls.js@^1.7.0` présent dans `apps/web/package.json`
- 17 tests couvrant : sélection préférée, variante explicite valide, ID inconnu, status UNAVAILABLE, source disabled, resume position, M3U URL shape, Xtream URL shape, non-logging des credentials, no-candidate error

---

### Problèmes détectés

#### 🔴 Bloquant — HLS instance non détruite au cleanup

**Fichier** : `apps/web/src/pages/PlayerPage.tsx`, lignes 29–53

```typescript
if (streamUrl.includes('.m3u8')) {
  import('hls.js').then(({ default: Hls }) => {
    if (Hls.isSupported()) {
      const hls = new Hls()           // ← instance créée dans .then() async
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      // cleanup returned to caller below  ← commentaire trompeur
    }
  })
}
return () => {
  video.src = ''                       // ← hls.destroy() jamais appelé
}
```

Quand `streamUrl` change (changement de variante) ou quand le composant est démonté :

1. Le cleanup React exécute `video.src = ''` — l'instance HLS précédente reste active en mémoire et continue à télécharger des segments réseau.
2. Race condition : si React exécute le cleanup avant que la Promise `import('hls.js')` soit résolue, la nouvelle instance HLS sera quand même créée et appellera `hls.attachMedia(video)` sur un composant nettoyé.
3. Lors d'un `switchVariant()`, deux instances HLS (ou plus) peuvent se disputer le même élément `<video>`.

Ce bug affecte directement le critère d'acceptation : *"L'utilisateur peut choisir explicitement une autre variante/availability valide."*

**Correction attendue** — capturer la référence HLS dans une variable du scope de l'effect et l'inclure dans le cleanup :

```typescript
useEffect(() => {
  const video = videoRef.current
  if (!video || !streamUrl) return

  let hlsInstance: import('hls.js').default | null = null
  let cancelled = false

  if (streamUrl.includes('.m3u8')) {
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (Hls.isSupported()) {
        hlsInstance = new Hls()
        hlsInstance.loadSource(streamUrl)
        hlsInstance.attachMedia(video)
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
      }
    }).catch(() => {
      if (!cancelled && video) video.src = streamUrl
    })
  } else {
    video.src = streamUrl
  }

  return () => {
    cancelled = true
    hlsInstance?.destroy()
    video.src = ''
  }
}, [streamUrl])
```

---

#### 🟡 Non-bloquant — Source de type PLEX silencieusement traitée comme M3U

**Fichier** : `apps/api/src/services/playback-resolver.ts`, lignes 131–141

```typescript
if (source.type === 'XTREAM') {
  streamUrl = buildXtreamStreamUrl(...)
} else {
  // M3U: providerItemId stores the direct stream URL
  streamUrl = buildM3UStreamUrl(selected.providerItemId)   // ← branch else attrape aussi PLEX
}
```

Le schéma DB définit 3 types : `XTREAM | M3U | PLEX`. Si une source PLEX existe avec des availabilities, elle passera la validation (`status === 'AVAILABLE'`, `enabled === true`) puis entrera dans la branch `else`. `providerItemId` d'une source PLEX n'est pas une URL de stream directe ; l'erreur sera opaque côté client plutôt qu'un message clair.

PLEX est out-of-scope pour ce ticket, mais une guard explicite préserve la lisibilité et évite une confusion future :

```typescript
if (source.type === 'XTREAM') {
  streamUrl = buildXtreamStreamUrl(...)
} else if (source.type === 'M3U') {
  streamUrl = buildM3UStreamUrl(selected.providerItemId)
} else {
  throw new ValidationError('Variant not available')
}
```

---

#### 🔵 Observation — Test mock sensible à l'ordre des appels DB

**Fichier** : `apps/api/src/services/__tests__/playback-resolver.test.ts`, lignes 52–65

Le mock de `db` utilise une queue (`dbResultQueue`) qui dépend de l'ordre exact des appels `select().from().where()`. Si l'ordre des requêtes dans `resolvePlayback` change, tous les tests échouent silencieusement avec des données incorrectes plutôt que de lever des erreurs explicites. Ce n'est pas bloquant aujourd'hui mais c'est à surveiller.

---

### Risques éventuels

- **Accumulation de connexions réseau** : sans `hls.destroy()`, chaque changement de variante ou navigation crée une connection HLS orpheline jusqu'au garbage collector. Sur une session longue avec plusieurs changements de variante, cela peut impacter les performances navigateur.
- **Régression `sourceMap.get(selected.providerId)!`** (ligne 126) : assertion non-null supposant que `selected` est toujours dans `candidates`. Ceci est garanti par la logique du code, mais toute modification future qui dissocierait `candidates` de `sourceMap` casserait ce point silencieusement.

---

### Décision

L'implémentation est fonctionnellement solide sur le backend et la gestion des credentials est correcte. Le problème bloquant est localisé et sa correction est précise : il ne remet pas en cause l'architecture ni les autres fichiers.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T050/reviews/implementation-review.md
- generated at: 2026-08-13T01:45:57Z

---

I have enough information to write the full review.

---

## PR Review — T050: Secure Web Playback Flow from Selected Availability

### Résumé

L'implémentation couvre l'ensemble des exigences du ticket : endpoint de résolution `/playback/resolve/:mediaType/:mediaId` protégé par JWT, isolation des credentials Xtream/M3U dans les URL de stream, validation server-side des variantes, 17 tests unitaires, page player Web avec reprise de position et sélection de variante, et intégration du suivi de progression. La grande majorité du code est correcte et bien structurée — il y a cependant un bug de cleanup HLS qui impacte directement le critère d'acceptation de changement de variante, et un cas de type source non géré qui peut provoquer un comportement silencieux inattendu.

---

### Vérifications effectuées

- Plan vs. implémentation : tous les fichiers listés dans le plan ont été produits
- Sécurité : isolation des credentials, absence de `streamUrl` dans les DTOs catalogue, réponses d'erreur sans détails provider
- Validation server-side : status UNAVAILABLE → 400, source disabled → 403, ID inconnu → 404, tous mappés à `'Variant not available'` côté client
- Enregistrement des routes dans le scope protégé (JWT `authenticate` hook)
- Frontend : routing, usePlayback, useProgressSync, PlayerPage
- Tests : couverture des 7 scénarios requis par le plan
- Type contracts : `PlaybackSessionResponse` et `AvailabilityVariantResponse` n'exposent aucun champ credential

---

### Points validés

- `POST /playback/resolve/:mediaType/:mediaId` correctement enregistré dans `protectedScope` (`apps/api/src/index.ts:92`)
- `streamUrl` absent de tous les DTOs catalogue ; `PlaybackSessionResponse` est un contrat isolé dans `packages/api-contracts/src/playback.ts`
- `alternatives: AvailabilityVariantResponse[]` ne contient ni `providerItemId` ni `streamUrl`, uniquement des métadonnées de variante
- Le resolver revalide toujours côté serveur même si le client fournit un `availabilityId` explicite — le chemin "explicit ID not in candidates" lève bien un `NotFoundError` via `allRows.find(...)` avant d'accéder à `candidates`
- Les 3 catégories d'erreur sont mappées à des messages génériques sans internals provider dans `apps/api/src/routes/playback.ts:37-46`
- Le logger Fastify (pino) n'est jamais appelé avec `streamUrl` dans le service ni les URL builders — test `secret redaction` vérifié
- `useProgressSync` : debounce 10 s sur `timeupdate`, envoi final sur `ended`, listeners correctement retirés au cleanup
- Bouton Play Movie conditionnel à `availabilityStatus === 'AVAILABLE'` (`MovieDetailPage.tsx:221`)
- Bouton Lire Episode conditionnel à `!isUnavailable` (`EpisodeRow.tsx:46`)
- Route `/player/:mediaType/:mediaId` enregistrée sans AppShell dans `App.tsx:31`
- `hls.js@^1.7.0` présent dans `apps/web/package.json`
- 17 tests couvrant : sélection préférée, variante explicite valide, ID inconnu, status UNAVAILABLE, source disabled, resume position, M3U URL shape, Xtream URL shape, non-logging des credentials, no-candidate error

---

### Problèmes détectés

#### 🔴 Bloquant — HLS instance non détruite au cleanup

**Fichier** : `apps/web/src/pages/PlayerPage.tsx`, lignes 29–53

```typescript
if (streamUrl.includes('.m3u8')) {
  import('hls.js').then(({ default: Hls }) => {
    if (Hls.isSupported()) {
      const hls = new Hls()           // ← instance créée dans .then() async
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      // cleanup returned to caller below  ← commentaire trompeur
    }
  })
}
return () => {
  video.src = ''                       // ← hls.destroy() jamais appelé
}
```

Quand `streamUrl` change (changement de variante) ou quand le composant est démonté :

1. Le cleanup React exécute `video.src = ''` — l'instance HLS précédente reste active en mémoire et continue à télécharger des segments réseau.
2. Race condition : si React exécute le cleanup avant que la Promise `import('hls.js')` soit résolue, la nouvelle instance HLS sera quand même créée et appellera `hls.attachMedia(video)` sur un composant nettoyé.
3. Lors d'un `switchVariant()`, deux instances HLS (ou plus) peuvent se disputer le même élément `<video>`.

Ce bug affecte directement le critère d'acceptation : *"L'utilisateur peut choisir explicitement une autre variante/availability valide."*

**Correction attendue** — capturer la référence HLS dans une variable du scope de l'effect et l'inclure dans le cleanup :

```typescript
useEffect(() => {
  const video = videoRef.current
  if (!video || !streamUrl) return

  let hlsInstance: import('hls.js').default | null = null
  let cancelled = false

  if (streamUrl.includes('.m3u8')) {
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (Hls.isSupported()) {
        hlsInstance = new Hls()
        hlsInstance.loadSource(streamUrl)
        hlsInstance.attachMedia(video)
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
      }
    }).catch(() => {
      if (!cancelled && video) video.src = streamUrl
    })
  } else {
    video.src = streamUrl
  }

  return () => {
    cancelled = true
    hlsInstance?.destroy()
    video.src = ''
  }
}, [streamUrl])
```

---

#### 🟡 Non-bloquant — Source de type PLEX silencieusement traitée comme M3U

**Fichier** : `apps/api/src/services/playback-resolver.ts`, lignes 131–141

```typescript
if (source.type === 'XTREAM') {
  streamUrl = buildXtreamStreamUrl(...)
} else {
  // M3U: providerItemId stores the direct stream URL
  streamUrl = buildM3UStreamUrl(selected.providerItemId)   // ← branch else attrape aussi PLEX
}
```

Le schéma DB définit 3 types : `XTREAM | M3U | PLEX`. Si une source PLEX existe avec des availabilities, elle passera la validation (`status === 'AVAILABLE'`, `enabled === true`) puis entrera dans la branch `else`. `providerItemId` d'une source PLEX n'est pas une URL de stream directe ; l'erreur sera opaque côté client plutôt qu'un message clair.

PLEX est out-of-scope pour ce ticket, mais une guard explicite préserve la lisibilité et évite une confusion future :

```typescript
if (source.type === 'XTREAM') {
  streamUrl = buildXtreamStreamUrl(...)
} else if (source.type === 'M3U') {
  streamUrl = buildM3UStreamUrl(selected.providerItemId)
} else {
  throw new ValidationError('Variant not available')
}
```

---

#### 🔵 Observation — Test mock sensible à l'ordre des appels DB

**Fichier** : `apps/api/src/services/__tests__/playback-resolver.test.ts`, lignes 52–65

Le mock de `db` utilise une queue (`dbResultQueue`) qui dépend de l'ordre exact des appels `select().from().where()`. Si l'ordre des requêtes dans `resolvePlayback` change, tous les tests échouent silencieusement avec des données incorrectes plutôt que de lever des erreurs explicites. Ce n'est pas bloquant aujourd'hui mais c'est à surveiller.

---

### Risques éventuels

- **Accumulation de connexions réseau** : sans `hls.destroy()`, chaque changement de variante ou navigation crée une connection HLS orpheline jusqu'au garbage collector. Sur une session longue avec plusieurs changements de variante, cela peut impacter les performances navigateur.
- **Régression `sourceMap.get(selected.providerId)!`** (ligne 126) : assertion non-null supposant que `selected` est toujours dans `candidates`. Ceci est garanti par la logique du code, mais toute modification future qui dissocierait `candidates` de `sourceMap` casserait ce point silencieusement.

---

### Décision

L'implémentation est fonctionnellement solide sur le backend et la gestion des credentials est correcte. Le problème bloquant est localisé et sa correction est précise : il ne remet pas en cause l'architecture ni les autres fichiers.

IMPLEMENTATION_FIX_REQUIRED