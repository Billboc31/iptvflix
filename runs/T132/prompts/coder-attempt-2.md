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


# T132 — Build the Live TV dashboard UI with categories, favorites and EPG-ready cards

**Source**: GitHub Issue #279

## Description

## Context

With a standalone Live TV app and canonicalized channels, IPTVFlix needs the production Live TV dashboard itself.

## Visual target

Use this mockup as the primary UI reference:

![IPTVFlix Live TV target](https://raw.githubusercontent.com/Billboc31/iptvflix/main/CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png)

Source: `CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png` at repository root.

The visual direction is deliberate: dark IPTVFlix shell, **orange** accent, sidebar navigation, top VOD/TV switch, strong channel logos, compact EPG information, horizontal featured rails and dense but readable all-channels list.

## Goal

Implement the Live TV consumer dashboard against canonical channel APIs, closely following the visual hierarchy of the reference screen.

## Required sections

### Top shell

- IPTVFLIX branding.
- VOD / TV switch with TV active in orange.
- Search affordance.
- Current profile/user control reuse where appropriate.

### Sidebar

Include navigation foundation for:

- Accueil TV
- Favoris
- Récemment regardées
- Guide TV
- Toutes les chaînes

And channel categories such as:

- Généralistes
- Sport
- Cinéma & Séries
- Infos
- Enfants
- Musique
- Documentaires
- Divertissement
- International

Categories must come from canonical/data-driven channel category information rather than title-specific hardcoding.

### En direct maintenant

Create a prominent horizontal rail of live channels.

Each card should support:

- channel logo;
- `LIVE` badge;
- current program name where EPG exists;
- program start/end time;
- progress indicator based on current time;
- immediate play action.

If EPG is not yet available, the card still renders cleanly with channel identity and live status.

### Recently watched

Provide a compact rail for recent canonical channels, ready to consume actual history state when available.

If no history exists yet, omit the rail rather than fabricate content.

### Channels by category

Show category shortcut cards with channel counts, following the visual reference.

### All channels

Build a dense searchable/filterable canonical channel list/grid with:

- favorite toggle;
- clean canonical logo/name;
- current/next EPG information where available;
- live progress;
- play action;
- useful filters such as favorites, HD/4K where reliable, French/international/category as data allows.

Do not display raw duplicate `ChannelSource` records to the user.

## EPG readiness

This ticket should be **EPG-ready**, even if full XMLTV/EPG ingestion lands separately.

Define UI contracts/components so `now` / `next` program information, start/end times and progress can be supplied without rewriting channel cards later.

No fake schedules should be used in production UI when EPG data is absent.

## Favorites and history readiness

- Favorite action should target canonical `Channel` identity, not a technical stream source.
- Recently watched/history should also reference canonical channels.
- If the underlying persistence already exists, wire it; otherwise establish clean frontend/domain seams rather than inventing temporary local-only behavior that will need replacement.

## Playback

- Clicking play/channel should launch the preferred stream selected by the canonical channel/source-selection layer.
- UI should not expose provider/source choice in the normal happy path.
- Surface graceful playback failure/retry/fallback behavior.

## Responsive behavior

- Desktop/tablet layout should strongly follow the reference.
- Mobile should collapse sidebar/navigation sensibly while keeping search, categories and channel cards usable.
- Design should remain compatible with future TV/remote focus navigation, even though this ticket targets the Live TV web app.

## Acceptance criteria

- Live TV dashboard visually follows the provided orange/black mockup.
- Top VOD/TV switch and Live TV sidebar are implemented.
- Live channels are shown using canonical channel identities/logos.
- Featured live rail, category shortcuts and all-channels area render from real API data.
- No duplicate provider streams appear as separate cards when canonicalization has grouped them.
- EPG-present and EPG-absent states both render cleanly.
- Favorites/history semantics are canonical-channel based.
- Search/filter works on canonical channel metadata.
- Empty/error/loading states are graceful and isolated by section where appropriate.
- Existing VOD UI is not restyled/regressed by Live TV-specific orange theme.
- Add automated/component tests for major dashboard sections, EPG/no-EPG states, canonical channel rendering, filtering and playback action wiring.
- No channel-specific hacks and no fake production EPG data.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 29 tests pass, live-tv typecheck is clean. Here's a summary of everything implemented:

---

## Changes Summary

### API Contracts (`packages/api-contracts/src/channels.ts`)
- Added `EpgProgram` type with `title`, `startTime`, `endTime`
- Extended `ChannelResponse` with optional `epg?: { now?, next? }` and `isFavorite?`
- Added `ChannelFavoriteRequest` and `ChannelHistoryEntry` types

### Backend — DB
- **`apps/api/src/db/schema/channel-favorites.ts`** — new table, unique on `(profileId, channelId)`
- **`apps/api/src/db/schema/channel-history.ts`** — new table (no unique constraint, last-write wins)
- **`apps/api/src/db/schema/index.ts`** — exports both new tables
- **`apps/api/migrations/0054_t132_channel_favorites_history.sql`** — migration with FKs to `profiles` and `channels`

### Backend — Routes
- **`apps/api/src/routes/channel-favorites.ts`** — `GET /channels/favorites`, `POST/DELETE /channels/:id/favorite`
- **`apps/api/src/routes/channel-history.ts`** — `GET /channels/history` (deduped, top 20), `POST /channels/:id/history`
- **`apps/api/src/routes/channels.ts`** — extended with `?favorites=1` filter and `isFavorite` per-channel field
- **`apps/api/src/index.ts`** — registered both new route handlers in `profileScope`

### Frontend — Components (`apps/live-tv/src/components/channel/`)
- **`ChannelLogo.tsx`** — logo with initials fallback, `sm/md/lg` sizes
- **`EpgProgress.tsx`** — orange progress bar from `startTime`/`endTime`, renders nothing when absent
- **`ChannelCard.tsx`** — EPG-ready card with LIVE badge, play action, inline error, favorite toggle
- **`LiveRail.tsx`** — horizontal scroll rail with 3 skeleton cards while loading, hidden when empty
- **`CategoryShortcuts.tsx`** — data-driven grid from `channel.categories`, links to `/channels?category=`
- **`ChannelRow.tsx`** — dense list row with EPG now/next, progress bar, favorite, play

### Frontend — Context
- **`apps/live-tv/src/context/ChannelsContext.tsx`** — single fetch for channels/favorites/history, optimistic favorite toggle, fire-and-forget history recording

### Frontend — Pages
- **`HomePage.tsx`** — En direct rail + category shortcuts + recently watched (omitted when empty)
- **`AllChannelsPage.tsx`** — functional search (via URL `?q=`), category filter, favorites-only toggle, `ChannelRow` list
- **`FavoritesPage.tsx`** — shows favorited channels from context; empty state when none
- **`RecentPage.tsx`** — shows recent channels from context; empty state when none

### Frontend — Layout
- **`Sidebar.tsx`** — collapsible categories section (desktop only) derived from channel data
- **`TopBar.tsx`** — search icon that expands inline, routes to `/channels?q=`
- **`App.tsx`** — `ChannelsProvider` wraps `AppShell` so all pages share the same channel data

### Tests (29 passing)
- `EpgProgress.test.tsx` — 6 tests: percentage math, clamping, absent times
- `ChannelCard.test.tsx` — 8 tests: EPG-present/absent, play action, error state, favorite toggle
- `LiveRail.test.tsx` — 4 tests: loading skeletons, empty suppression, data rendering
- `AllChannelsPage.test.tsx` — 6 tests: search, category filter, favorites-only, toggleFavorite wiring
- `ChannelsContext.test.tsx` — 5 tests: data loading, optimistic add/remove favorite, history recording

---

## Review

I have enough information to write the complete review. Let me compile it now.

---

# PR Review — T132: Live TV Dashboard UI

## Résumé

L'implémentation couvre de manière solide le périmètre du ticket : shell avec TopBar + Sidebar, rail "En direct maintenant", rail "Récemment regardées", raccourcis catégories, page "Toutes les chaînes" avec recherche/filtres, favoris persistés côté API, contrats EPG-ready, et cinq suites de tests unitaires. Le code est lisible, les composants bien découpés, la sécurité respecte le modèle auth/profile de l'API existante.

Un problème fonctionnel bloquant a été identifié : l'enregistrement de l'historique n'est pas déclenché lors de la lecture d'une chaîne.

---

## Vérifications effectuées

- Lecture de tous les composants frontend clés (ChannelCard, ChannelRow, LiveRail, HomePage, AllChannelsPage, Sidebar, TopBar, EpgProgress, CategoryShortcuts)
- Lecture du contexte partagé (ChannelsContext, lib/api.ts)
- Lecture des routes API (channels, channel-favorites, channel-history)
- Vérification de la migration SQL et des foreign keys
- Vérification du modèle d'auth (protectedScope vs profileScope)
- Lecture des cinq fichiers de tests unitaires
- Vérification des fichiers VOD non touchés au niveau source

---

## Points validés

**Architecture et sécurité**
- `channelFavoritesRoutes` et `channelHistoryRoutes` sont bien dans `profileScope` (requireProfile middleware) — les données sont correctement scopées par profil.
- `channelsRoutes` dans `protectedScope` — la route publique `/channels` gère le cas `profileId = null` proprement.
- Migration `0054` : foreign keys avec `ON DELETE CASCADE` sur `profiles` et `channels` — pas de données orphelines.
- `addFavorite` utilise `onConflictDoNothing` — idempotent, pas d'erreur si double-ajout.
- Pas de secret exposé, pas de log de données sensibles.

**Conformité ticket**
- Top shell : branding IPTVFlix, switch VOD/TV (TV actif en orange), recherche, affichage profil — ✓
- Sidebar : 5 items de navigation + catégories dynamiques depuis l'API — ✓ (pas de catégories hardcodées)
- Rail "En direct maintenant" : logo, badge LIVE, EPG si disponible, progress bar, play — ✓
- États EPG présent / EPG absent : les deux paths rendent proprement — ✓
- "Récemment regardées" : rail omis si history vide, affiché si présent — ✓ (logique côté rendu)
- Catégories en raccourcis avec comptage dynamique — ✓
- "Toutes les chaînes" : search + filtre favoris + filtre catégorie — ✓
- Favoris : canonical channel-based, persistés via API, optimistic update avec rollback — ✓
- Pas de doublons ChannelSource en affichage (seul le canonical channel est exposé) — ✓
- Contrats EPG (`EpgProgram.now`, `.next`, `startTime`, `endTime`) définis dans `api-contracts` — ✓
- Pas de fausses données EPG en production — ✓
- VOD source inchangé (seuls des artefacts compilés et `.env.example` modifiés) — ✓
- Tests unitaires : ChannelCard, AllChannelsPage, ChannelsContext, EpgProgress, LiveRail — ✓

**Qualité code**
- Composants courts, nommage explicite, séparation des responsabilités.
- `EpgProgress` : calcul borné à [0, 100], guard sur `end <= start`, attributs ARIA `progressbar`.
- `ChannelCard` et `ChannelRow` : erreurs réseau distinctes (404 vs autre), spinner pendant le chargement.
- `ChannelsContext` : fire-and-forget pour history (`void`), pas de blocage UI.

---

## Problèmes détectés

### 🔴 BLOQUANT — Histoire non enregistrée lors de la lecture

**Fichiers concernés** : `ChannelCard.tsx`, `LiveRail.tsx`, `ChannelRow.tsx`, `ChannelsContext.tsx`

`recordHistory` est défini dans `ChannelsContext` et les routes API (`POST /channels/:id/history`) existent. Cependant, `recordHistory` n'est jamais appelé quand l'utilisateur clique sur "Regarder".

- `ChannelCard` expose un prop `onPlay?: (streamUrl: string) => void` qui permettrait d'injecter `recordHistory`, mais `LiveRail` ne le passe pas.
- `ChannelRow` n'a pas de prop `onPlay` du tout.
- `AllChannelsPage` ne passe pas non plus de callback play.

**Conséquence** : le rail "Récemment regardées" n'affichera que l'historique pré-existant chargé au démarrage. Les nouvelles lectures ne sont jamais enregistrées. Le critère "If the underlying persistence already exists, wire it" n'est pas satisfait alors que la persistance existe.

**Correction attendue** : passer `onPlay` depuis `LiveRail` vers `ChannelCard`, et depuis `ChannelRow` vers son handler interne, en appelant `recordHistory(channel.id)` après l'ouverture du stream.

Exemple minimal pour `LiveRail.tsx` :
```tsx
// passer onPlay qui appelle recordHistory puis ouvre le stream
onPlay={(url) => { onRecordHistory?.(ch.id); window.open(url, '_blank', 'noopener') }}
```

### 🟡 MINEUR — EpgProgress statique (pas de rafraîchissement)

`EpgProgress` calcule le pourcentage une seule fois lors du render (via `Date.now()`). Le progrès n'évolue pas en temps réel si l'utilisateur reste sur la page. Acceptable pour un premier livrable, mais à noter pour une amélioration future (setInterval ou requestAnimationFrame).

### 🟡 MINEUR — Bouton favoris inaccessible au toucher sur le rail

Dans `ChannelCard`, le bouton favori utilise `opacity-0 group-hover:opacity-100`. Sur mobile/touch, sans hover, le bouton est invisible. Les favoris restent accessibles via `ChannelRow` dans "Toutes les chaînes" (le bouton reste visible pour les chaînes déjà favorites), mais pas depuis le rail principal sur mobile.

### 🟡 MINEUR — Filtre HD/4K non implémenté

Le ticket mentionne "filtres HD/4K où fiable". Pas implémenté — le ticket qualifie cela avec "where reliable" ce qui laisse une latitude, et le modèle de données canonique ne semble pas exposer d'indicateur HD. À confirmer si intentionnellement différé.

---

## Risques éventuels

- **Token dans l'URL pour le switch VOD/TV** : `handleVodSwitch` place le JWT en query param (`?token=...`). C'est un pattern existant (T130/T131), pas nouveau dans ce ticket. Le token est supprimé de l'URL immédiatement via `history.replaceState`. Risque résiduel faible (browser history), pattern à documenter mais non bloquant ici.
- **`selectDistinctOn` PostgreSQL** : la route history utilise une syntaxe PG-spécifique. Sans risque dans ce projet qui est PostgreSQL-only, mais à noter.

---

## Décision

L'implémentation est globalement solide et couvre la grande majorité des critères d'acceptance. Un problème fonctionnel bloquant empêche l'approbation : l'historique de visionnage n'est pas enregistré lors de la lecture, alors que la persistence est en place et que `recordHistory` est défini dans le contexte.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T132/reviews/implementation-review.md
- generated at: 2026-08-25T09:47:13Z

---

I have enough information to write the complete review. Let me compile it now.

---

# PR Review — T132: Live TV Dashboard UI

## Résumé

L'implémentation couvre de manière solide le périmètre du ticket : shell avec TopBar + Sidebar, rail "En direct maintenant", rail "Récemment regardées", raccourcis catégories, page "Toutes les chaînes" avec recherche/filtres, favoris persistés côté API, contrats EPG-ready, et cinq suites de tests unitaires. Le code est lisible, les composants bien découpés, la sécurité respecte le modèle auth/profile de l'API existante.

Un problème fonctionnel bloquant a été identifié : l'enregistrement de l'historique n'est pas déclenché lors de la lecture d'une chaîne.

---

## Vérifications effectuées

- Lecture de tous les composants frontend clés (ChannelCard, ChannelRow, LiveRail, HomePage, AllChannelsPage, Sidebar, TopBar, EpgProgress, CategoryShortcuts)
- Lecture du contexte partagé (ChannelsContext, lib/api.ts)
- Lecture des routes API (channels, channel-favorites, channel-history)
- Vérification de la migration SQL et des foreign keys
- Vérification du modèle d'auth (protectedScope vs profileScope)
- Lecture des cinq fichiers de tests unitaires
- Vérification des fichiers VOD non touchés au niveau source

---

## Points validés

**Architecture et sécurité**
- `channelFavoritesRoutes` et `channelHistoryRoutes` sont bien dans `profileScope` (requireProfile middleware) — les données sont correctement scopées par profil.
- `channelsRoutes` dans `protectedScope` — la route publique `/channels` gère le cas `profileId = null` proprement.
- Migration `0054` : foreign keys avec `ON DELETE CASCADE` sur `profiles` et `channels` — pas de données orphelines.
- `addFavorite` utilise `onConflictDoNothing` — idempotent, pas d'erreur si double-ajout.
- Pas de secret exposé, pas de log de données sensibles.

**Conformité ticket**
- Top shell : branding IPTVFlix, switch VOD/TV (TV actif en orange), recherche, affichage profil — ✓
- Sidebar : 5 items de navigation + catégories dynamiques depuis l'API — ✓ (pas de catégories hardcodées)
- Rail "En direct maintenant" : logo, badge LIVE, EPG si disponible, progress bar, play — ✓
- États EPG présent / EPG absent : les deux paths rendent proprement — ✓
- "Récemment regardées" : rail omis si history vide, affiché si présent — ✓ (logique côté rendu)
- Catégories en raccourcis avec comptage dynamique — ✓
- "Toutes les chaînes" : search + filtre favoris + filtre catégorie — ✓
- Favoris : canonical channel-based, persistés via API, optimistic update avec rollback — ✓
- Pas de doublons ChannelSource en affichage (seul le canonical channel est exposé) — ✓
- Contrats EPG (`EpgProgram.now`, `.next`, `startTime`, `endTime`) définis dans `api-contracts` — ✓
- Pas de fausses données EPG en production — ✓
- VOD source inchangé (seuls des artefacts compilés et `.env.example` modifiés) — ✓
- Tests unitaires : ChannelCard, AllChannelsPage, ChannelsContext, EpgProgress, LiveRail — ✓

**Qualité code**
- Composants courts, nommage explicite, séparation des responsabilités.
- `EpgProgress` : calcul borné à [0, 100], guard sur `end <= start`, attributs ARIA `progressbar`.
- `ChannelCard` et `ChannelRow` : erreurs réseau distinctes (404 vs autre), spinner pendant le chargement.
- `ChannelsContext` : fire-and-forget pour history (`void`), pas de blocage UI.

---

## Problèmes détectés

### 🔴 BLOQUANT — Histoire non enregistrée lors de la lecture

**Fichiers concernés** : `ChannelCard.tsx`, `LiveRail.tsx`, `ChannelRow.tsx`, `ChannelsContext.tsx`

`recordHistory` est défini dans `ChannelsContext` et les routes API (`POST /channels/:id/history`) existent. Cependant, `recordHistory` n'est jamais appelé quand l'utilisateur clique sur "Regarder".

- `ChannelCard` expose un prop `onPlay?: (streamUrl: string) => void` qui permettrait d'injecter `recordHistory`, mais `LiveRail` ne le passe pas.
- `ChannelRow` n'a pas de prop `onPlay` du tout.
- `AllChannelsPage` ne passe pas non plus de callback play.

**Conséquence** : le rail "Récemment regardées" n'affichera que l'historique pré-existant chargé au démarrage. Les nouvelles lectures ne sont jamais enregistrées. Le critère "If the underlying persistence already exists, wire it" n'est pas satisfait alors que la persistance existe.

**Correction attendue** : passer `onPlay` depuis `LiveRail` vers `ChannelCard`, et depuis `ChannelRow` vers son handler interne, en appelant `recordHistory(channel.id)` après l'ouverture du stream.

Exemple minimal pour `LiveRail.tsx` :
```tsx
// passer onPlay qui appelle recordHistory puis ouvre le stream
onPlay={(url) => { onRecordHistory?.(ch.id); window.open(url, '_blank', 'noopener') }}
```

### 🟡 MINEUR — EpgProgress statique (pas de rafraîchissement)

`EpgProgress` calcule le pourcentage une seule fois lors du render (via `Date.now()`). Le progrès n'évolue pas en temps réel si l'utilisateur reste sur la page. Acceptable pour un premier livrable, mais à noter pour une amélioration future (setInterval ou requestAnimationFrame).

### 🟡 MINEUR — Bouton favoris inaccessible au toucher sur le rail

Dans `ChannelCard`, le bouton favori utilise `opacity-0 group-hover:opacity-100`. Sur mobile/touch, sans hover, le bouton est invisible. Les favoris restent accessibles via `ChannelRow` dans "Toutes les chaînes" (le bouton reste visible pour les chaînes déjà favorites), mais pas depuis le rail principal sur mobile.

### 🟡 MINEUR — Filtre HD/4K non implémenté

Le ticket mentionne "filtres HD/4K où fiable". Pas implémenté — le ticket qualifie cela avec "where reliable" ce qui laisse une latitude, et le modèle de données canonique ne semble pas exposer d'indicateur HD. À confirmer si intentionnellement différé.

---

## Risques éventuels

- **Token dans l'URL pour le switch VOD/TV** : `handleVodSwitch` place le JWT en query param (`?token=...`). C'est un pattern existant (T130/T131), pas nouveau dans ce ticket. Le token est supprimé de l'URL immédiatement via `history.replaceState`. Risque résiduel faible (browser history), pattern à documenter mais non bloquant ici.
- **`selectDistinctOn` PostgreSQL** : la route history utilise une syntaxe PG-spécifique. Sans risque dans ce projet qui est PostgreSQL-only, mais à noter.

---

## Décision

L'implémentation est globalement solide et couvre la grande majorité des critères d'acceptance. Un problème fonctionnel bloquant empêche l'approbation : l'historique de visionnage n'est pas enregistré lors de la lecture, alors que la persistence est en place et que `recordHistory` est défini dans le contexte.

IMPLEMENTATION_FIX_REQUIRED