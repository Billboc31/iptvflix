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


# T054 — Add Netflix-style autoplay previews on Home and catalog browsing

**Source**: GitHub Issue #103

## Description

## Objective

Add optional Netflix-style short autoplay previews while browsing Home/catalog/detail surfaces so users can quickly understand a Movie or Series without opening a separate trailer action first.

## Context / Problem

IPTVFlix now has recommendation-backed Shelves/Home and is adding rich detail pages with trailer metadata. The next UX step is lightweight preview playback similar to modern streaming apps: focus/hover/selection can transition a static hero/card into a muted trailer/teaser preview after a deliberate delay.

This must remain controlled, performant and non-annoying, especially on mobile and future TV clients.

## Included

- Reuse canonical trailer/video metadata introduced by the detail/trailer feature; do not perform YouTube searches directly from card components.
- Implement autoplay preview behavior for the Home hero and selected/high-intent catalog surfaces.
- On desktop, support delayed hover/focus preview where appropriate; on touch devices do not emulate hover and avoid surprise autoplay.
- Start previews muted by default and provide clear mute/unmute and replay/open-detail controls where relevant.
- Stop preview immediately when focus/hover/visibility moves away; never allow multiple simultaneous previews.
- Respect browser autoplay restrictions and fall back cleanly to static backdrop/poster when autoplay is denied.
- Respect `prefers-reduced-motion` and expose a user/profile setting to disable autoplay previews.
- Lazy-load/embed preview players only after user intent/delay to avoid loading many YouTube embeds across a Shelf.
- Use a privacy-conscious YouTube embed mode where practical.
- Ensure cards remain usable with keyboard navigation and that preview behavior does not trap focus.
- Define the preview component/API so the future Android TV client can use the same trailer metadata while implementing TV-native focus behavior separately.

## Acceptance Criteria

- [ ] Home hero can transition from backdrop to a muted trailer/teaser preview when a valid preview exists.
- [ ] Supported desktop card/focus interactions can start a preview only after a deliberate delay, not immediately on incidental pointer movement.
- [ ] Only one preview can play at a time and it stops when the item is no longer active/visible.
- [ ] No trailer metadata means the normal static card/hero remains unchanged.
- [ ] Browser autoplay failure does not produce a broken/blank card.
- [ ] Users can disable autoplay previews and reduced-motion preferences are respected.
- [ ] Touch/mobile behavior avoids unwanted automatic video playback.
- [ ] Loading is lazy/bounded; rendering a Shelf does not instantiate a video player for every item.
- [ ] Automated frontend tests cover preview availability, delay/cancel, single-active-player, autoplay-disabled and no-preview fallbacks.

## Excluded / Out of scope

- Generating custom preview clips from full IPTV video streams.
- Hosting/transcoding trailer media.
- Android TV-specific preview implementation.

## Dependencies

Depends on #102 (canonical trailer/video metadata and integrated trailer support). It can use the current Home/Shelf architecture and should remain independent of provider-specific availability.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 8 HeroSection tests and all 12 PosterCard tests pass. Full suite: 20 test files, 129 tests, no failures.

The root cause was stale TypeScript-compiled `.js` artifacts left in the source tree alongside the `.tsx` sources. When Vitest resolved `./HeroSection.js`, it found and loaded the pre-T054 compiled artifact (which had no preview logic, no context usage, no mute button) instead of the updated `HeroSection.tsx`. Same for `PosterCard.js`. Deleting all compiled artifacts from `src/` lets Vitest fall back to the TypeScript sources for all `.js` imports.

---

## Review

---

# PR Review — T054: Netflix-style Autoplay Previews

## Résumé

L'implémentation couvre la quasi-totalité du ticket T054 avec une architecture claire, des tests bien structurés, et un respect général du plan. Deux problèmes bloquants ont été identifiés : un conflit de numérotation de migration qui empêchera la colonne `autoplay_previews` d'être créée, et l'absence de navigation clavier/clic sur les cartes de `ShelfRow`.

---

## Vérifications effectuées

- Contrats API (`packages/api-contracts/`) : `catalog.ts`, `shelves.ts`, `profile.ts`
- Backend : migration SQL, schéma Drizzle, `profile-service.ts`, `shelf-service.ts`, `home-service.ts`, `catalog-service.ts`, `routes/profile.ts`, `routes/movies.ts`
- Frontend : `PreviewContext.tsx`, `PreviewPlayer.tsx`, `HeroSection.tsx`, `PosterCard.tsx`, `ShelfRow.tsx`, `App.tsx`, `ProfileSettingsPage.tsx`
- Tests : `PreviewContext.test.tsx`, `PreviewPlayer.test.tsx`, `HeroSection.test.tsx`, `PosterCard.test.tsx`, `ShelfRow.test.tsx`
- Journal de migrations : `apps/api/migrations/meta/_journal.json`

---

## Points validés

- **API contracts** : `trailerKey: string | null` correctement ajouté à `MovieResponse` et `ShelfItem`. `autoplayPreviews: boolean` ajouté à `ProfilePreferences`.
- **Backend trailerKey** : `catalog-service.listMovies`, `shelf-service` (toutes les branches system/dynamic/manual), `home-service` — tous réalisent un batch fetch via `inArray` sur `mediaVideos`, aucun N+1.
- **`PreviewContext`** : gestion `prefers-reduced-motion` avec listener dynamique, `autoplayPreviews` lu une fois au mount, refs stables pour `activate`/`deactivate`.
- **`PreviewPlayer`** : iframe youtube-nocookie montée uniquement quand `active=true`, unmontée sur `active=false`, `tabIndex=-1` pour éviter le piège focus, fallback visuel sur erreur (`visibility: hidden`), opacité en transition pour éviter le flash.
- **`HeroSection`** : timer 2 s, nettoyage au unmount, garde `pointer: coarse`, bouton mute/unmute avec `aria-label`.
- **`PosterCard`** : timer 1,5 s sur hover/focus, annulation sur mouseLeave/blur, garde touch, cleanup au unmount.
- **`ProfileSettingsPage`** : toggle checkbox avec label explicite, sauvegarde via `updateProfilePreferences`.
- **`routes/profile.ts`** : validation `typeof body.autoplayPreviews !== 'boolean'` → 400.
- **`profile-service`** : merge patch correct avec gestion de `'autoplayPreviews' in patch` pour supporter la valeur `false`.
- **Tests** : couverture de `activate`/`deactivate`, no-op reduced-motion, no-op autoplay disabled, delay/cancel, touch guard, unmount cleanup — tous présents.
- **Un seul player actif** : `activate` remplace directement `activeId`/`activeKey` dans le contexte ; aucune instanciation multiple possible.

---

## Problèmes détectés

### 🔴 BLOQUANT #1 — Migration `0021_autoplay_previews.sql` absente du journal

**Fichier** : `apps/api/migrations/meta/_journal.json`

L'entrée `idx: 21` est déjà enregistrée dans le journal avec le tag `0021_tv_pairing_commands`. Le fichier `0021_autoplay_previews.sql` existe sur disque mais n'est **pas référencé dans le journal**. Drizzle-kit utilise le journal pour tracker les migrations appliquées : cette migration ne sera donc jamais exécutée en production.

**Conséquence** : la colonne `autoplay_previews` n'existera pas dans la base de données. L'API crashera à l'accès `profile.autoplayPreviews` dans `profile-service.ts`.

**Correction requise** :
1. Renommer le fichier SQL en `0022_autoplay_previews.sql`
2. Ajouter l'entrée `idx: 22` dans `_journal.json` avec le bon tag
3. Mettre à jour le snapshot correspondant dans `apps/api/migrations/meta/`

---

### 🔴 BLOQUANT #2 — Cards de `ShelfRow` non navigables (clavier et clic)

**Fichier** : `apps/web/src/components/content/ShelfRow.tsx`, lignes 26–31

`ShelfRow` ne passe aucun `onClick` à `PosterCard`. Or `PosterCard` (sur main comme dans cette branche) ne rend `role="button"` et `tabIndex={0}` que si `onClick` est fourni :
```tsx
role={onClick ? 'button' : undefined}
tabIndex={onClick ? 0 : undefined}
```

Sans `onClick`, les cartes sont **non interactives au clavier** et non cliquables. Le ticket exige explicitement : *"Ensure cards remain usable with keyboard navigation and that preview behavior does not trap focus"*. Le plan précise également *"Card click and keyboard Enter remain fully functional while preview is active"*.

La conséquence directe : `PosterCard.onFocus` ne peut jamais se déclencher depuis le clavier (pas de tabIndex), rendant le scénario de preview au focus non testable en practice.

**Correction requise** : passer un handler de navigation à chaque `PosterCard` dans `ShelfRow` :
```tsx
<PosterCard
  title={item.title}
  posterUrl={item.posterUrl}
  mediaId={item.mediaId}
  trailerKey={item.trailerKey}
  onClick={() => navigate(`/${item.mediaType === 'MOVIE' ? 'movies' : 'series'}/${item.mediaId}`)}
/>
```
Cela nécessite d'importer `useNavigate` dans `ShelfRow`.

---

### 🟡 MINEUR #1 — `postMessage` avec target origin `'*'`

**Fichier** : `apps/web/src/components/content/PreviewPlayer.tsx`, ligne 22

```tsx
iframeRef.current.contentWindow.postMessage(JSON.stringify({...}), '*')
```

L'origine cible `'*'` est acceptable pour communiquer vers une iframe externe (l'origine de l'iframe ne peut pas être connue à l'avance depuis le contexte parent). Non bloquant — le message ne contient aucune donnée sensible.

---

### 🟡 MINEUR #2 — Préférence `autoplayPreviews` non reflétée immédiatement après sauvegarde

`PreviewContext` lit `autoplayPreviews` une seule fois au mount. Si l'utilisateur désactive l'option dans `ProfileSettingsPage` puis revient à l'accueil sans rechargement, des previews peuvent encore se déclencher.

Le plan admet ce comportement ("reflected in the PreviewContext on next load"), mais aucun test ne documente cette limitation. Non bloquant, mais une note dans l'UI ou un event bus minimal permettrait de l'éviter.

---

### 🟡 MINEUR #3 — `badge` prop non threadée dans `ShelfRow`

`PosterCard` accepte un `badge?: { label: string; variant: ... }` (hérité du main). `ShelfRow` ne le passe jamais. Les badges d'indisponibilité/upcoming ne s'affichent donc pas sur les cartes des shelves. Hors scope T054, mais c'est un oubli à documenter.

---

### ℹ️ INFO — Séries dans `sys_continue_watching` sans trailerKey

**Fichier** : `apps/api/src/services/shelf-service.ts`, ligne 80

Les items de type `SERIES` dans "Continuer à regarder" ont toujours `trailerKey: null`. Le commentaire en code l'explique (les épisodes ne portent pas l'ID de la série parente). Comportement acceptable et documenté.

---

## Risques éventuels

- Le crash au démarrage API (migration manquante) est un risque de production immédiat si la branche est mergée telle quelle.
- L'absence de navigation dans ShelfRow peut passer inaperçue en review mais brise l'expérience utilisateur de base.

---

## Décision

REQUEST_CHANGES — 2 problèmes bloquants à corriger avant merge.

## Actions demandées

1. **[BLOQUANT]** Renommer `0021_autoplay_previews.sql` → `0022_autoplay_previews.sql`, enregistrer l'entrée `idx: 22` dans `_journal.json`, et mettre à jour le snapshot Drizzle correspondant.
2. **[BLOQUANT]** Ajouter `useNavigate` dans `ShelfRow.tsx` et passer un `onClick` de navigation à chaque `PosterCard`.
3. **[MINEUR]** (optionnel) Documenter la limitation "live update" de `PreviewContext` dans un test commenté ou une note UI.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T054/reviews/implementation-review.md
- generated at: 2026-08-13T01:31:07Z

---

---

# PR Review — T054: Netflix-style Autoplay Previews

## Résumé

L'implémentation couvre la quasi-totalité du ticket T054 avec une architecture claire, des tests bien structurés, et un respect général du plan. Deux problèmes bloquants ont été identifiés : un conflit de numérotation de migration qui empêchera la colonne `autoplay_previews` d'être créée, et l'absence de navigation clavier/clic sur les cartes de `ShelfRow`.

---

## Vérifications effectuées

- Contrats API (`packages/api-contracts/`) : `catalog.ts`, `shelves.ts`, `profile.ts`
- Backend : migration SQL, schéma Drizzle, `profile-service.ts`, `shelf-service.ts`, `home-service.ts`, `catalog-service.ts`, `routes/profile.ts`, `routes/movies.ts`
- Frontend : `PreviewContext.tsx`, `PreviewPlayer.tsx`, `HeroSection.tsx`, `PosterCard.tsx`, `ShelfRow.tsx`, `App.tsx`, `ProfileSettingsPage.tsx`
- Tests : `PreviewContext.test.tsx`, `PreviewPlayer.test.tsx`, `HeroSection.test.tsx`, `PosterCard.test.tsx`, `ShelfRow.test.tsx`
- Journal de migrations : `apps/api/migrations/meta/_journal.json`

---

## Points validés

- **API contracts** : `trailerKey: string | null` correctement ajouté à `MovieResponse` et `ShelfItem`. `autoplayPreviews: boolean` ajouté à `ProfilePreferences`.
- **Backend trailerKey** : `catalog-service.listMovies`, `shelf-service` (toutes les branches system/dynamic/manual), `home-service` — tous réalisent un batch fetch via `inArray` sur `mediaVideos`, aucun N+1.
- **`PreviewContext`** : gestion `prefers-reduced-motion` avec listener dynamique, `autoplayPreviews` lu une fois au mount, refs stables pour `activate`/`deactivate`.
- **`PreviewPlayer`** : iframe youtube-nocookie montée uniquement quand `active=true`, unmontée sur `active=false`, `tabIndex=-1` pour éviter le piège focus, fallback visuel sur erreur (`visibility: hidden`), opacité en transition pour éviter le flash.
- **`HeroSection`** : timer 2 s, nettoyage au unmount, garde `pointer: coarse`, bouton mute/unmute avec `aria-label`.
- **`PosterCard`** : timer 1,5 s sur hover/focus, annulation sur mouseLeave/blur, garde touch, cleanup au unmount.
- **`ProfileSettingsPage`** : toggle checkbox avec label explicite, sauvegarde via `updateProfilePreferences`.
- **`routes/profile.ts`** : validation `typeof body.autoplayPreviews !== 'boolean'` → 400.
- **`profile-service`** : merge patch correct avec gestion de `'autoplayPreviews' in patch` pour supporter la valeur `false`.
- **Tests** : couverture de `activate`/`deactivate`, no-op reduced-motion, no-op autoplay disabled, delay/cancel, touch guard, unmount cleanup — tous présents.
- **Un seul player actif** : `activate` remplace directement `activeId`/`activeKey` dans le contexte ; aucune instanciation multiple possible.

---

## Problèmes détectés

### 🔴 BLOQUANT #1 — Migration `0021_autoplay_previews.sql` absente du journal

**Fichier** : `apps/api/migrations/meta/_journal.json`

L'entrée `idx: 21` est déjà enregistrée dans le journal avec le tag `0021_tv_pairing_commands`. Le fichier `0021_autoplay_previews.sql` existe sur disque mais n'est **pas référencé dans le journal**. Drizzle-kit utilise le journal pour tracker les migrations appliquées : cette migration ne sera donc jamais exécutée en production.

**Conséquence** : la colonne `autoplay_previews` n'existera pas dans la base de données. L'API crashera à l'accès `profile.autoplayPreviews` dans `profile-service.ts`.

**Correction requise** :
1. Renommer le fichier SQL en `0022_autoplay_previews.sql`
2. Ajouter l'entrée `idx: 22` dans `_journal.json` avec le bon tag
3. Mettre à jour le snapshot correspondant dans `apps/api/migrations/meta/`

---

### 🔴 BLOQUANT #2 — Cards de `ShelfRow` non navigables (clavier et clic)

**Fichier** : `apps/web/src/components/content/ShelfRow.tsx`, lignes 26–31

`ShelfRow` ne passe aucun `onClick` à `PosterCard`. Or `PosterCard` (sur main comme dans cette branche) ne rend `role="button"` et `tabIndex={0}` que si `onClick` est fourni :
```tsx
role={onClick ? 'button' : undefined}
tabIndex={onClick ? 0 : undefined}
```

Sans `onClick`, les cartes sont **non interactives au clavier** et non cliquables. Le ticket exige explicitement : *"Ensure cards remain usable with keyboard navigation and that preview behavior does not trap focus"*. Le plan précise également *"Card click and keyboard Enter remain fully functional while preview is active"*.

La conséquence directe : `PosterCard.onFocus` ne peut jamais se déclencher depuis le clavier (pas de tabIndex), rendant le scénario de preview au focus non testable en practice.

**Correction requise** : passer un handler de navigation à chaque `PosterCard` dans `ShelfRow` :
```tsx
<PosterCard
  title={item.title}
  posterUrl={item.posterUrl}
  mediaId={item.mediaId}
  trailerKey={item.trailerKey}
  onClick={() => navigate(`/${item.mediaType === 'MOVIE' ? 'movies' : 'series'}/${item.mediaId}`)}
/>
```
Cela nécessite d'importer `useNavigate` dans `ShelfRow`.

---

### 🟡 MINEUR #1 — `postMessage` avec target origin `'*'`

**Fichier** : `apps/web/src/components/content/PreviewPlayer.tsx`, ligne 22

```tsx
iframeRef.current.contentWindow.postMessage(JSON.stringify({...}), '*')
```

L'origine cible `'*'` est acceptable pour communiquer vers une iframe externe (l'origine de l'iframe ne peut pas être connue à l'avance depuis le contexte parent). Non bloquant — le message ne contient aucune donnée sensible.

---

### 🟡 MINEUR #2 — Préférence `autoplayPreviews` non reflétée immédiatement après sauvegarde

`PreviewContext` lit `autoplayPreviews` une seule fois au mount. Si l'utilisateur désactive l'option dans `ProfileSettingsPage` puis revient à l'accueil sans rechargement, des previews peuvent encore se déclencher.

Le plan admet ce comportement ("reflected in the PreviewContext on next load"), mais aucun test ne documente cette limitation. Non bloquant, mais une note dans l'UI ou un event bus minimal permettrait de l'éviter.

---

### 🟡 MINEUR #3 — `badge` prop non threadée dans `ShelfRow`

`PosterCard` accepte un `badge?: { label: string; variant: ... }` (hérité du main). `ShelfRow` ne le passe jamais. Les badges d'indisponibilité/upcoming ne s'affichent donc pas sur les cartes des shelves. Hors scope T054, mais c'est un oubli à documenter.

---

### ℹ️ INFO — Séries dans `sys_continue_watching` sans trailerKey

**Fichier** : `apps/api/src/services/shelf-service.ts`, ligne 80

Les items de type `SERIES` dans "Continuer à regarder" ont toujours `trailerKey: null`. Le commentaire en code l'explique (les épisodes ne portent pas l'ID de la série parente). Comportement acceptable et documenté.

---

## Risques éventuels

- Le crash au démarrage API (migration manquante) est un risque de production immédiat si la branche est mergée telle quelle.
- L'absence de navigation dans ShelfRow peut passer inaperçue en review mais brise l'expérience utilisateur de base.

---

## Décision

REQUEST_CHANGES — 2 problèmes bloquants à corriger avant merge.

## Actions demandées

1. **[BLOQUANT]** Renommer `0021_autoplay_previews.sql` → `0022_autoplay_previews.sql`, enregistrer l'entrée `idx: 22` dans `_journal.json`, et mettre à jour le snapshot Drizzle correspondant.
2. **[BLOQUANT]** Ajouter `useNavigate` dans `ShelfRow.tsx` et passer un `onClick` de navigation à chaque `PosterCard`.
3. **[MINEUR]** (optionnel) Documenter la limitation "live update" de `PreviewContext` dans un test commenté ou une note UI.

---

IMPLEMENTATION_FIX_REQUIRED