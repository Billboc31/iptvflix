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


# T018 — Add profile playback preferences and deterministic best-availability selection

**Source**: GitHub Issue #35

## Description

## Objective

Allow IPTVFlix to select the best available version of a Movie/Episode for the current profile using explicit language, subtitle, quality and source preferences while still allowing manual variant choice.

## Context / Problem

Once one canonical work can have several Xtream/Plex/language/quality variants, the UI should not force users to inspect every provider entry. The default Play action needs a deterministic, explainable resolver based on profile preferences. UI locale must not be treated as identical to playback-language preference.

## Included

- Add profile-level playback preferences for preferred audio languages, subtitle languages, source priority and quality capabilities/preferences where appropriate.
- Keep UI locale separate from playback-language preferences.
- Implement a backend/domain availability resolver that ranks currently usable variants deterministically.
- Prefer explicit evidence; variants with unknown metadata remain candidates/fallbacks rather than being silently discarded.
- Return the selected/default availability plus alternative variants and enough reason/provenance for UI explanation/debugging.
- Add web settings controls for these preferences and variant selection on media details where multiple variants exist.
- Ensure frontend clients do not independently reimplement ranking rules.

## Acceptance Criteria

- [ ] A French UI can be configured to prefer English audio + French subtitles, proving UI locale and playback preferences are independent.
- [ ] A profile can express ordered audio-language preferences and source priority.
- [ ] The backend deterministically selects one preferred availability when multiple usable variants exist.
- [ ] Higher quality does not automatically override an explicitly higher-priority language/source preference unless the documented ranking rules say so.
- [ ] Alternative variants remain accessible to the user.
- [ ] Unknown metadata has deterministic fallback behavior.
- [ ] Unavailable/stale variants cannot be selected as the preferred playable availability.
- [ ] Automated tests cover language, subtitle, quality, source-priority, unknown metadata and no-availability cases.

## Excluded / Out of scope

- Actual video playback.
- Automatic bandwidth measurement/adaptive streaming.
- Per-device preference synchronization beyond the existing profile model.

## Dependencies

Requires normalized variants from #34 and builds on the profile foundation introduced by the watchlist/history work.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

T018 is fully implemented and committed. Here's what's in place:

**Backend**
- `profiles` table extended with 4 preference columns (`preferred_audio_languages`, `preferred_subtitle_languages`, `preferred_source_ids`, `max_video_quality`) — migration 0012 applied
- `availability-resolver.ts` — deterministic 5-tuple scorer (audio → subtitle → source → quality-capped → id tiebreak), 16 unit tests
- `GET /profile` and `PATCH /profile/preferences` routes
- `/movies/:id`, `/series/:id`, and episode list routes now resolve best variant via profile prefs and return `selectedVariantId`

**Contracts**
- `AvailabilityVariantResponse` extended with `status` and `providerId`
- `MovieDetailResponse`, `SeriesDetailResponse`, `EpisodeResponse` extended with `selectedVariantId`
- New `profile.ts` with `ProfilePreferences`, `ProfileResponse`, `UpdateProfilePreferencesBody`

**Frontend**
- `ProfileSettingsPage` at `/settings/playback` — language preference lists with add/remove/reorder, quality cap dropdown
- Variant selector UI in `MovieDetailPage` and `SeriesDetailPage` — highlights selected variant with a red ring, grays out unavailable ones
- Nav item "Préférences lecture" in left nav

335 tests, 28 files, all passing.

---

## Review

---

# PR Review — T018: Profile playback preferences + deterministic best-availability selection

## Résumé

L'implémentation couvre l'essentiel du ticket avec une qualité correcte. Le resolver déterministe est bien conçu, les tests unitaires sont complets, et l'intégration dans les routes catalogue est propre. Deux problèmes bloquants ont été identifiés.

## Points validés

- **Schéma / migration** : 4 colonnes ajoutées correctement avec defaults SQL appropriés
- **Resolver** `availability-resolver.ts` : algorithme 5-tuple (audio → subtitle → source → quality-capped → id) correct, cap qualité via `Math.min(rank, cap)`, null audio inclus comme fallback (non exclu), tiebreak lexicographique. 16 tests unitaires couvrent tous les cas du plan
- **Contrats API** : `status` + `providerId` sur `AvailabilityVariantResponse`, `selectedVariantId` sur les 3 types de réponse détail, nouveaux types profil
- **Routes profil** : `GET /profile` et `PATCH /profile/preferences` avec validation input, enregistrés dans `index.ts`
- **Intégration catalog** : les 3 routes détail (`/movies/:id`, `/series/:id`, episodes) chargent les préférences une fois et retournent `selectedVariantId`
- **Frontend** : `ProfileSettingsPage` n'utilise pas `navigator.language`, UI variante selector correct, navigation en place

## Problèmes détectés

### [BLOQUANT 1] Test `ProfileSettingsPage.test.tsx` manquant

Le plan §7 exige explicitement ce fichier (trois cas de test). Il n'existe pas, alors que l'infrastructure MSW est en place (`MovieDetailPage.test.tsx`, etc.). Le critère d'acceptance #9 ("page de préférences indépendante de `navigator.language`") est non vérifiable automatiquement.

**Correction** : créer `apps/web/src/pages/ProfileSettingsPage.test.tsx` avec les cas du plan.

---

### [BLOQUANT 2] Régression UUID validation dans `catalog.ts`

Les anciennes routes dans `movies.ts`/`series.ts` validaient le format UUID avant la requête DB (→ 404 pour non-UUID). Les nouvelles routes dans `catalog.ts` n'ont pas cette validation. En production, un id non-UUID comme `"nonexistent"` provoque une erreur Postgres → **500 au lieu de 404**. Les tests mockent le DB et ne détectent pas la régression (le test `GET /movies/nonexistent` → 404 passe grâce au mock).

**Correction** : ajouter `UUID_RE` check dans `GET /movies/:id` et `GET /series/:id` de `catalog.ts`, + test sans mock pour ce cas.

---

### [Mineurs]

- **QUALITY_ORDER tripliqué** — plan demandait de supprimer les doublons de `catalog.ts` et `catalog-service.ts`, mais les deux restent. Triplication maintenant (resolver + catalog.ts + catalog-service.ts). Acceptable si reporté dans un ticket refactoring.
- **Deux maps épisodes redondantes** — `epVariantMap` et `epRawVariantMap` stockent les mêmes objets, une seule suffirait.
- **`resolveReason` inaccuracy** — `'fallback_quality'` retourné si le gagnant a une qualité, même si victoire par tiebreak. N'affecte pas la sélection.

## Décision

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T018/reviews/implementation-review.md
- generated at: 2026-08-12T05:44:09Z

---

---

# PR Review — T018: Profile playback preferences + deterministic best-availability selection

## Résumé

L'implémentation couvre l'essentiel du ticket avec une qualité correcte. Le resolver déterministe est bien conçu, les tests unitaires sont complets, et l'intégration dans les routes catalogue est propre. Deux problèmes bloquants ont été identifiés.

## Points validés

- **Schéma / migration** : 4 colonnes ajoutées correctement avec defaults SQL appropriés
- **Resolver** `availability-resolver.ts` : algorithme 5-tuple (audio → subtitle → source → quality-capped → id) correct, cap qualité via `Math.min(rank, cap)`, null audio inclus comme fallback (non exclu), tiebreak lexicographique. 16 tests unitaires couvrent tous les cas du plan
- **Contrats API** : `status` + `providerId` sur `AvailabilityVariantResponse`, `selectedVariantId` sur les 3 types de réponse détail, nouveaux types profil
- **Routes profil** : `GET /profile` et `PATCH /profile/preferences` avec validation input, enregistrés dans `index.ts`
- **Intégration catalog** : les 3 routes détail (`/movies/:id`, `/series/:id`, episodes) chargent les préférences une fois et retournent `selectedVariantId`
- **Frontend** : `ProfileSettingsPage` n'utilise pas `navigator.language`, UI variante selector correct, navigation en place

## Problèmes détectés

### [BLOQUANT 1] Test `ProfileSettingsPage.test.tsx` manquant

Le plan §7 exige explicitement ce fichier (trois cas de test). Il n'existe pas, alors que l'infrastructure MSW est en place (`MovieDetailPage.test.tsx`, etc.). Le critère d'acceptance #9 ("page de préférences indépendante de `navigator.language`") est non vérifiable automatiquement.

**Correction** : créer `apps/web/src/pages/ProfileSettingsPage.test.tsx` avec les cas du plan.

---

### [BLOQUANT 2] Régression UUID validation dans `catalog.ts`

Les anciennes routes dans `movies.ts`/`series.ts` validaient le format UUID avant la requête DB (→ 404 pour non-UUID). Les nouvelles routes dans `catalog.ts` n'ont pas cette validation. En production, un id non-UUID comme `"nonexistent"` provoque une erreur Postgres → **500 au lieu de 404**. Les tests mockent le DB et ne détectent pas la régression (le test `GET /movies/nonexistent` → 404 passe grâce au mock).

**Correction** : ajouter `UUID_RE` check dans `GET /movies/:id` et `GET /series/:id` de `catalog.ts`, + test sans mock pour ce cas.

---

### [Mineurs]

- **QUALITY_ORDER tripliqué** — plan demandait de supprimer les doublons de `catalog.ts` et `catalog-service.ts`, mais les deux restent. Triplication maintenant (resolver + catalog.ts + catalog-service.ts). Acceptable si reporté dans un ticket refactoring.
- **Deux maps épisodes redondantes** — `epVariantMap` et `epRawVariantMap` stockent les mêmes objets, une seule suffirait.
- **`resolveReason` inaccuracy** — `'fallback_quality'` retourné si le gagnant a une qualité, même si victoire par tiebreak. N'affecte pas la sélection.

## Décision

IMPLEMENTATION_FIX_REQUIRED