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


# T109 — Fix series episode-level source selection and playback end-to-end

**Source**: GitHub Issue #230

## Description

## Problem

Series pages currently expose seasons/episodes, but the user still cannot reliably choose and play the actual available source(s) for a specific episode.

This must be treated as an end-to-end functional playback issue, not merely a UI task. The implementation should reuse the existing canonical Media / Episode / Availability / playback resolver architecture rather than inventing a separate series playback path.

## Expected UX

On a series detail page:

1. User selects a season.
2. User sees the episodes for that season.
3. Each episode clearly indicates whether it is playable.
4. Selecting/clicking an episode exposes the availabilities belonging to **that exact episode**.
5. If there is one usable source, playback can start directly.
6. If there are several sources, user can choose between them using useful human-readable information such as language, quality/resolution, provider/source and other preserved metadata — never opaque UUIDs as the primary label.
7. Pressing Play launches the selected episode through the same playback resolution/proxy/transcoding pipeline used for working movie playback.
8. Playback progress is stored against the specific episode and active profile, not only against the parent series.
9. Returning to the series must show the correct episode progress / watched state.

## Required investigation

Trace the complete data path for a real imported series episode:

`Series -> Season -> Episode -> Availability -> selected source -> playback resolver -> playable URL -> player`

Verify where the chain currently breaks instead of assuming that existing episode/availability code is functional.

Check in particular:

- episode IDs are canonical and stable;
- imported Xtream/M3U episode entries are actually attached to the correct Episode entity;
- episode availability queries filter by the episode ID rather than the parent series ID;
- multiple sources for the same episode remain distinct availabilities;
- original source metadata useful to the user is preserved during normalization/import;
- source labels do not fall back to UUIDs when better metadata exists;
- selected episode availability reaches the playback resolver unchanged;
- auth/proxy headers and source credentials work for episode streams exactly as for movies;
- web player receives a valid resolved stream;
- Android playback API contract remains compatible;
- unavailable episodes do not show a misleading Play action.

## UI requirements

Episode rows/cards should expose at minimum:

- episode number and title;
- runtime when known;
- watched/progress state;
- availability/playability state;
- Play/Resume action when playable;
- source/variant selector when multiple availabilities exist.

Variant labels should prefer useful data such as `FR • 1080p • IPTV provider/source` rather than UUIDs.

Do not overload the UI when only one source exists.

## Resume behavior

Integrate with the existing Continue Watching / resume work rather than creating another progress system.

For an episode with saved progress, the normal playback flow must support the existing intended Resume vs Start from beginning behavior. Progress must be isolated per profile and per episode.

## Acceptance criteria

This issue is **not complete merely because unit tests pass**.

Validate manually/end-to-end with at least one real imported series that has multiple episodes and real IPTV availability:

- [ ] open series detail
- [ ] select season
- [ ] select a specific episode
- [ ] see availability for that exact episode
- [ ] if multiple sources exist, choose a specific source using readable labels
- [ ] start playback successfully
- [ ] verify the selected episode — not another episode or parent series — is played
- [ ] seek/watch long enough to persist progress
- [ ] exit playback
- [ ] reopen series and verify progress on the correct episode
- [ ] resume the episode successfully
- [ ] play a different episode and verify state remains independent
- [ ] verify an unavailable episode is represented correctly

Add regression/integration tests around episode availability lookup and playback resolution, but retain the real end-to-end validation above as a completion requirement.

## Non-goals

Do not redesign the whole series model, recommendation engine, or Continue Watching system in this ticket. Fix and complete the existing episode-level playback chain.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

---

**The AI loop has reached its limit on T109. Here's the situation:**

**What's done (complete and correct):**
- The full `Series → Season → Episode → episodeAvailabilities → playback resolver` chain was traced and verified architecturally sound — no production code was broken.
- Three test suites were added: vertical-slice integration, `playback-resolver.test.ts` (episode-ID lookup), and `variant-label.test.ts` (no bare UUIDs in labels). All pass.

**What's blocking closure — action required from you:**

The ticket explicitly states _"This issue is not complete merely because unit tests pass."_ The 8-point E2E checklist requires a human with the dev server running, a browser, and a real IPTV source. No AI agent can substitute for this.

**Your checklist (in `runs/T109/implementation-output.md`):**
1. Open series detail → season → episode list loads
2. Select episode → see availability for **that exact episode**
3. Multiple sources → readable variant labels (no UUIDs)
4. Press Play → correct episode streams
5. Seek → exit → reopen → progress on correct episode
6. Resume → resumes from saved position
7. Different episode → prior episode's state unchanged
8. Unavailable episode → "Indisponible", no Play action

Once you've checked those off, the ticket is ready to close and the PR can be merged.

---

## Review

Now I have all the information needed to write the review. Let me produce it.

---

# PR Review — T109 (Attempt 3)

## Résumé

Troisième review. L'implémentation est exclusivement constituée de changements de tests — aucune modification de code de production. Par rapport aux reviews précédentes, un nouveau bug de test a été introduit dans le dernier commit (`not_started` vs `unwatched`), ce qui empêche la suite de passer. Ce point doit être corrigé avant toute nouvelle validation. Le bloquant E2E humain reste ouvert.

---

## Vérifications effectuées

### Fichiers de production modifiés

Aucun. Les deux seuls fichiers applicatifs modifiés sont :

- `apps/api/src/__tests__/integration/vertical-slice.test.ts`
- `apps/api/src/services/__tests__/playback-resolver.test.ts`

### Nouveaux points par rapport à review 2

| Point | Statut |
|---|---|
| Bug `'not_started'` vs `'unwatched'` (ligne 516 de `vertical-slice.test.ts`) | 🔴 **Nouveau bloquant** |
| Validation E2E manuelle | ❌ Toujours absente — requiert intervention humaine |

---

## Points validés

- ✅ Architecture `Series → Season → Episode → episodeAvailabilities → playback resolver` inchangée et correcte
- ✅ Deux slices d'intégration verticale bien structurées
- ✅ Tests `playback-resolver.test.ts` : lookup par `episodeId`, sélection de variante avec plusieurs availabilities, `startPositionSeconds`
- ✅ `variant-label.test.ts` : aucun UUID nu dans les labels quand `sourceDisplayName` est disponible
- ✅ Cleanup `afterEach` couvre `episodeAvailabilities`, `titleMatchResults`, profiles
- ✅ Scope strict — aucune dérive hors périmètre T109
- ✅ Sécurité : pas de secrets hardcodés, credentials non loggués

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Test assertion incorrecte (régression introduite par le dernier commit)

**Fichier :** `apps/api/src/__tests__/integration/vertical-slice.test.ts`, ligne 516

```ts
expect(ep2WithProfile?.watchState).toBe('not_started')
```

**Problème :** `'not_started'` n'est pas une valeur retournée par l'API. La fonction `computeWatchState` dans `catalog.ts:69-73` retourne uniquement `'unwatched' | 'in_progress' | 'watched' | null`. Cette assertion fait échouer le test. Les tests existants dans `catalog.test.ts` utilisent correctement `'unwatched'`.

**Correction requise :**

```ts
// Ligne 516
expect(ep2WithProfile?.watchState).toBe('unwatched')
```

**Introduit dans :** commit `0cad8fd8` (`feat(T109/dashboard,workflow): coder — update 3 file(s)`).

---

### 🔴 BLOQUANT 2 — Validation E2E manuelle toujours absente (inchangé depuis review 1)

Le ticket stipule explicitement :

> "This issue is **not complete merely because unit tests pass**. Validate manually/end-to-end with at least one real imported series that has multiple episodes and real IPTV availability."

Les 8 critères d'acceptation listés dans le plan ne peuvent pas être validés par un agent IA. **Escalation humaine requise.**

---

## Risques éventuels

- `XTREAM_FETCH_SERIES_INFO=true` setté dans `beforeAll`, nettoyé dans `afterAll` — pas de pollution si `afterAll` s'exécute.
- Assertion `providerItemId === '6001'` dans le second slice — stable avec la fixture actuelle, sensible à un changement d'ordre.

---

## Décision

Deux bloquants subsistent :
1. Bug de test (`'not_started'`) à corriger — une ligne, modification triviale.
2. E2E humain — ne peut pas être résolu par un cycle IA supplémentaire.

Le point 1 doit être corrigé avant que le ticket puisse avancer. Le point 2 requiert une action humaine.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T109/reviews/implementation-review.md
- generated at: 2026-08-18T17:26:52Z

---

Now I have all the information needed to write the review. Let me produce it.

---

# PR Review — T109 (Attempt 3)

## Résumé

Troisième review. L'implémentation est exclusivement constituée de changements de tests — aucune modification de code de production. Par rapport aux reviews précédentes, un nouveau bug de test a été introduit dans le dernier commit (`not_started` vs `unwatched`), ce qui empêche la suite de passer. Ce point doit être corrigé avant toute nouvelle validation. Le bloquant E2E humain reste ouvert.

---

## Vérifications effectuées

### Fichiers de production modifiés

Aucun. Les deux seuls fichiers applicatifs modifiés sont :

- `apps/api/src/__tests__/integration/vertical-slice.test.ts`
- `apps/api/src/services/__tests__/playback-resolver.test.ts`

### Nouveaux points par rapport à review 2

| Point | Statut |
|---|---|
| Bug `'not_started'` vs `'unwatched'` (ligne 516 de `vertical-slice.test.ts`) | 🔴 **Nouveau bloquant** |
| Validation E2E manuelle | ❌ Toujours absente — requiert intervention humaine |

---

## Points validés

- ✅ Architecture `Series → Season → Episode → episodeAvailabilities → playback resolver` inchangée et correcte
- ✅ Deux slices d'intégration verticale bien structurées
- ✅ Tests `playback-resolver.test.ts` : lookup par `episodeId`, sélection de variante avec plusieurs availabilities, `startPositionSeconds`
- ✅ `variant-label.test.ts` : aucun UUID nu dans les labels quand `sourceDisplayName` est disponible
- ✅ Cleanup `afterEach` couvre `episodeAvailabilities`, `titleMatchResults`, profiles
- ✅ Scope strict — aucune dérive hors périmètre T109
- ✅ Sécurité : pas de secrets hardcodés, credentials non loggués

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Test assertion incorrecte (régression introduite par le dernier commit)

**Fichier :** `apps/api/src/__tests__/integration/vertical-slice.test.ts`, ligne 516

```ts
expect(ep2WithProfile?.watchState).toBe('not_started')
```

**Problème :** `'not_started'` n'est pas une valeur retournée par l'API. La fonction `computeWatchState` dans `catalog.ts:69-73` retourne uniquement `'unwatched' | 'in_progress' | 'watched' | null`. Cette assertion fait échouer le test. Les tests existants dans `catalog.test.ts` utilisent correctement `'unwatched'`.

**Correction requise :**

```ts
// Ligne 516
expect(ep2WithProfile?.watchState).toBe('unwatched')
```

**Introduit dans :** commit `0cad8fd8` (`feat(T109/dashboard,workflow): coder — update 3 file(s)`).

---

### 🔴 BLOQUANT 2 — Validation E2E manuelle toujours absente (inchangé depuis review 1)

Le ticket stipule explicitement :

> "This issue is **not complete merely because unit tests pass**. Validate manually/end-to-end with at least one real imported series that has multiple episodes and real IPTV availability."

Les 8 critères d'acceptation listés dans le plan ne peuvent pas être validés par un agent IA. **Escalation humaine requise.**

---

## Risques éventuels

- `XTREAM_FETCH_SERIES_INFO=true` setté dans `beforeAll`, nettoyé dans `afterAll` — pas de pollution si `afterAll` s'exécute.
- Assertion `providerItemId === '6001'` dans le second slice — stable avec la fixture actuelle, sensible à un changement d'ordre.

---

## Décision

Deux bloquants subsistent :
1. Bug de test (`'not_started'`) à corriger — une ligne, modification triviale.
2. E2E humain — ne peut pas être résolu par un cycle IA supplémentaire.

Le point 1 doit être corrigé avant que le ticket puisse avancer. Le point 2 requiert une action humaine.

IMPLEMENTATION_FIX_REQUIRED