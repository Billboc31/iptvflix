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


# T126 — Cache personalized Home and add stable quality-gated hero

**Source**: GitHub Issue #268

## Description

## Context

The personalized Home from #266 is now rendering production shelves, but loading/refreshing the page appears to recompute recommendation work each time. This is unnecessarily slow and may repeat LLM/token-consuming shelf generation or other expensive personalization work.

The current Home hero is also not good enough: an arbitrary/low-value catalog title can occupy the most prominent position on the page. The hero must be intentional, personalized and stable — or absent.

## Goals

1. Make normal Home loads fast by serving a previously computed personalized Home snapshot instead of rebuilding expensive recommendation context on every refresh.
2. Introduce a personalized, stable, quality-gated Home hero.
3. Avoid unnecessary LLM/token usage while keeping recommendations fresh enough.

## Personalized Home snapshot / cache

Persist/materialize the computed Home discovery result per user/profile.

A normal `GET Home` should primarily read the latest valid snapshot and must not synchronously regenerate thematic shelves or invoke LLM-dependent generation simply because the browser/app refreshed.

The snapshot should contain enough information to reconstruct the discovery Home rails without rerunning the recommendation pipeline.

`Continuer à regarder` / playback progress may remain live or be merged with the snapshot at read time because it changes independently and is cheap behavioral data.

### Refresh policy

Use a clear freshness policy rather than recalculating on every request. Initial reasonable behavior:

- keep a personalized discovery snapshot valid for roughly 24h;
- allow explicit/controlled invalidation or refresh after meaningful profile signals such as future like/dislike/seen feedback;
- catalog changes may mark snapshots stale when appropriate, without requiring immediate synchronous regeneration for every request;
- when a stale snapshot exists, prefer **stale-while-revalidate** behavior: return the last valid Home immediately and rebuild in background/async where the current architecture supports it;
- never block the Home unnecessarily on expensive thematic/LLM generation if a usable previous snapshot exists.

Exact persistence mechanism should fit the existing architecture; do not introduce infrastructure solely for caching if the existing DB/storage model can cleanly materialize the result.

### Observability

Add enough diagnostics/logging to distinguish at least:

- snapshot/cache hit;
- snapshot miss;
- stale snapshot served;
- regeneration triggered;
- expensive/LLM-dependent generation triggered.

This should make it possible to verify that repeated page refreshes do **not** repeatedly consume tokens/recompute the same Home.

## Personalized Home hero

Replace arbitrary hero selection with a dedicated hero selection policy.

The hero should be selected from strong personalized candidates (for example from the high-confidence `Pour toi` candidate pool) but with stricter eligibility rules than a normal shelf item.

### Hero eligibility / quality gate

A hero candidate should normally:

- be actually playable/available in the user's catalog;
- have suitable hero/backdrop artwork and usable metadata;
- have a valid display title/localization for the user;
- satisfy preferred language/localization expectations where metadata allows it;
- not be disliked;
- eventually respect seen-state rules once the feedback model lands;
- have sufficiently strong recommendation confidence/relevance;
- avoid obviously low-quality/obscure catalog noise when stronger candidates exist.

Do **not** fill the hero at all costs.

If no candidate passes the quality gate, render **no hero** and start the Home naturally with `Continuer à regarder` / the first available shelf. A missing hero is preferable to a bad hero.

## Hero stability

The selected hero belongs to the Home snapshot and should remain stable for the snapshot lifetime (target ~24h initially). Browser refreshes must not randomly rotate it.

A newly regenerated Home may select a new hero.

Avoid showing the exact same title immediately again as the first item of `Pour toi` when enough good alternatives exist; the hero can participate in the existing cross-shelf diversity policy.

## Performance / token requirement

After a Home snapshot has been generated, repeated Home refreshes within its validity window should require **zero LLM calls for Home shelf/theme generation** and should avoid recomputing expensive semantic/reranking work that can safely be reused.

Do not optimize away cheap live state such as playback progress where freshness matters.

## UX

- Keep existing Home rails from #266.
- Hero remains a consumer-facing recommendation, never a diagnostic element.
- If hero is absent, layout must collapse cleanly with no large empty/black reserved hero area.
- If artwork fails, degrade gracefully rather than displaying a broken giant banner.

## Acceptance criteria

- Repeated Home refreshes within the snapshot TTL serve the same discovery Home without rerunning expensive/LLM shelf generation.
- Snapshot/cache behavior is per user/profile.
- Home can serve the last usable snapshot while a stale one is being regenerated where feasible.
- `Continuer à regarder` can reflect current playback state independently of the discovery snapshot.
- Hero is personalized and selected through explicit eligibility/quality rules, not arbitrary catalog ordering/random selection.
- Hero stays stable across refreshes for the snapshot lifetime.
- No eligible hero => no hero section and no empty reserved hero space.
- Hero/cross-shelf duplication is reduced when alternatives exist.
- Add automated tests covering snapshot hit/miss/staleness, per-profile isolation, no repeated expensive generation on refresh, hero eligibility, hero stability, and no-hero fallback.
- Existing recommendation preview/diagnostic tooling continues to work.
- No title-specific hacks and no manual production DB changes.