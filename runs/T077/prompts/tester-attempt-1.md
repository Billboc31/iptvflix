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

# Role — Tester

## Mission

Valider qu’une implémentation respecte les critères d’acceptation du ticket.

## Tu dois

- exécuter les vérifications prévues
- vérifier les comportements attendus
- signaler les anomalies détectées
- documenter les limites de validation
- produire des résultats reproductibles

## Tu ne dois pas

- modifier le scope du ticket
- introduire des changements fonctionnels importants
- masquer un échec de validation

## Sortie attendue

- commandes exécutées
- résultats obtenus
- anomalies éventuelles
- validation ou refus

## Règles

- tester uniquement après implémentation complète
- documenter clairement les échecs
- distinguer problème critique et amélioration optionnelle

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

# SKILL: testing

# Skill — Testing

## Objectif

Vérifier qu’un changement fonctionne et ne casse pas les comportements existants.

## Règles

- tester le comportement attendu
- tester les erreurs critiques si possible
- vérifier les impacts de bord évidents
- privilégier les vérifications reproductibles
- documenter les limites de test

## Refuser si

- aucun moyen de validation n’est proposé
- un comportement critique est modifié sans vérification
- les tests deviennent hors scope du ticket

---

# SKILL: debugging

# Skill — Debugging

## Objectif

Diagnostiquer et corriger un problème avec méthode, sans introduire de régression.

## Règles

- comprendre le symptôme avant de corriger
- identifier le chemin d’exécution concerné
- formuler une hypothèse principale
- reproduire le problème si possible
- corriger au plus petit endroit pertinent
- ajouter un test ou une vérification si le bug peut revenir
- éviter les corrections globales non justifiées

## Refuser si

- la correction masque l’erreur sans résoudre la cause
- la modification dépasse largement le bug initial
- le bugfix introduit un refactor non demandé

---

# TASK

# Generic Tester Task

Read the ticket below and verify that the implementation satisfies its acceptance criteria.

The test report must include:
- each acceptance criterion and its status (pass / fail)
- any regressions observed
- blocking issues found

The ticket follows.


# T077 — Fix Xtream VOD playback URL resolution for movies and episodes

**Source**: GitHub Issue #162

## Description

## Problem
Clicking `Regarder` currently resolves a playback session but media does not actually play.

The existing playback resolver has a concrete correctness issue for Xtream VOD:

- `buildXtreamStreamUrl()` currently always builds `/{username}/{password}/{providerItemId}.ts`.
- Movie and episode availability rows already persist `container_extension`, but `playback-resolver.ts` does not select/use it.
- Movie and episode playback need provider-specific VOD path construction rather than assuming the same path/extension for every media type.

This ticket fixes provider-side playback URL resolution first, before adding browser/player workarounds.

## Goal
Make `POST /playback/resolve/:mediaType/:mediaId` return a valid, testable Xtream playback target for canonical Movies and Episodes using the selected availability metadata.

## Requirements

### 1. Media-type-aware Xtream URL building
Build the correct Xtream VOD URL according to media type/provider semantics.

The resolver MUST distinguish:
- movie VOD;
- series episode VOD;
- future live TV (do not incorrectly reuse VOD path logic).

Do not hardcode one generic `/{user}/{pass}/{id}.ts` URL for all content.

The Planner must inspect the existing Xtream client responses and provider conventions already used by IPTVFlix and implement the correct path structure for Movies vs Episodes.

### 2. Use persisted container extension
`movie_availabilities` and `episode_availabilities` already have `container_extension`.

Include this field in playback resolution and use it when constructing the provider URL.

Examples may include `mkv`, `mp4`, `avi`, `ts`, etc. Do not silently force `.ts` when the provider exposes another extension.

If extension is absent, use a deliberate provider-specific fallback and make that fallback observable/tested.

### 3. Availability selection remains canonical
Keep the current canonical model:
- Movie/Episode identity stays canonical;
- selected availability determines provider/source/language/quality/playback reference;
- explicit availability selection must work;
- automatic variant resolution must still honor profile preferences.

### 4. Validate provider item IDs
Ensure the selected `provider_item_id` is actually the VOD/episode stream identifier expected by the Xtream endpoint, not a series/catalog id.

For Episodes, verify sync/backfill persists the correct Xtream episode stream id.

### 5. Source URL/base URL normalization
Handle provider base URLs robustly:
- trailing slash;
- http/https;
- ports;
- already-normalized base URLs.

Do not double-add path segments.

### 6. Diagnostics without leaking credentials
When playback URL construction or provider access fails, logs should identify:
- source id/type;
- media type/id;
- availability id;
- provider item id;
- container extension;
- HTTP/result category when probed.

Never log username/password or full credential-bearing playback URLs.

### 7. Test real URL construction behavior
Add unit/integration tests for at least:
- Movie Xtream URL with mp4 extension;
- Movie Xtream URL with mkv extension;
- Episode Xtream URL with provider episode id;
- missing extension fallback;
- explicit availability selection;
- disabled source / unavailable variant;
- malformed provider data.

## Acceptance criteria
- [ ] Movie playback resolver uses Movie-specific Xtream VOD URL semantics.
- [ ] Episode playback resolver uses Episode-specific Xtream VOD URL semantics.
- [ ] Persisted `container_extension` is read and used.
- [ ] Playback no longer forces `.ts` for every Xtream VOD item.
- [ ] Episode playback uses the actual episode stream/provider item id.
- [ ] Existing language/quality variant selection still works.
- [ ] Invalid/unavailable variants produce actionable errors.
- [ ] Logs do not expose Xtream credentials.
- [ ] Automated tests prove generated playback targets for Movies and Episodes.

## Current code evidence
`apps/api/src/providers/xtream/playback.ts` currently builds a generic `/{username}/{password}/{providerItemId}.ts` URL, while `apps/api/src/db/schema/availabilities.ts` already stores `container_extension`. `apps/api/src/services/playback-resolver.ts` currently ignores that field.