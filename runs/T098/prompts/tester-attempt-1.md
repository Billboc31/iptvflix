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


# T098 — Introduce Account -> Profile foundation and move all personalization state to profiles

**Source**: GitHub Issue #201

## Description

## Context
IPTVFlix needs a real multi-user / multi-profile foundation before we build deeper personalization and infinite recommendation shelves.

The desired product model is Netflix-like:

```text
Account / household
  ├── Profile A
  ├── Profile B
  ├── Profile C
  └── Kids profile
```

The Account authenticates with login/email + password and owns shared household resources. Each Profile owns all personal viewing state, preferences and recommendation signals.

This ticket is the DATA / AUTH / API FOUNDATION. It should not overbuild the final profile-selection UI; a follow-up ticket handles Web/Mobile/Android TV UX.

## Goal
Create a first-class `Account -> Profiles` model and ensure every user-specific behavior is scoped by `profileId` rather than being globally attached to the account/user.

A profile switch must be able to produce a completely independent IPTVFlix experience without logging out of the account.

## 1. Account model
Audit the existing user/auth schema and evolve it safely into an Account/household concept.

Account owns at minimum:
- authentication credentials / identity;
- account-level settings;
- shared configured media sources (Xtream/M3U/Plex where current product semantics expect household sharing);
- paired devices / TV association where appropriate;
- profiles;
- global/admin settings that are not personal taste.

Do not duplicate existing auth records unnecessarily. Migrate/refactor the current user model cleanly if one already exists.

## 2. Profile model
Add a canonical Profile entity, for example:

```text
Profile
- id
- accountId
- name
- avatarKey / avatarUrl
- isKids
- maturityLevel / contentRestriction (future-compatible)
- preferredUiLanguage
- preferredAudioLanguages
- preferredSubtitleLanguages
- subtitlesEnabledPreference
- autoplayNextEpisode
- autoSkipIntro
- autoSkipRecap
- autoSkipOutro / credits behavior
- neverStopMode
- createdAt
- updatedAt
- lastUsedAt
```

Use normalized tables where JSON would become hard to query/change. The exact schema can adapt to existing code.

## 3. Current profile context
After account authentication, API requests that operate on personal state must have a resolved current `profileId`.

Support a clean mechanism such as:
- explicit profile-selection endpoint that issues/updates session context;
- profile ID in authenticated session/token context;
- or equivalent secure server-side session design.

Do NOT trust an arbitrary client-supplied profileId without verifying that the profile belongs to the authenticated account.

Expose:
- list profiles for current account;
- create profile;
- update profile;
- delete profile with safe constraints;
- select/switch current profile;
- read current profile.

## 4. Migrate existing personalized state to profile scope
Audit every current table/API that represents personal behavior and move it to `profileId` semantics.

At minimum investigate and migrate:
- watch progress;
- Continue Watching / resume state;
- Continue Watching dismissal (#195);
- watched/completed movies;
- watched/completed episodes;
- My List / favorites;
- likes/dislikes/ratings if present;
- search history if persisted;
- playback preferences;
- preferred audio/subtitle language;
- selected source/quality preference if personal;
- episode progress;
- autoplay/skip settings;
- recommendation history/signals if already present;
- profile-specific shelf state if any.

No profile should ever see another profile's personal state.

## 5. Interaction-event store for future recommendations
Create a durable, privacy-conscious profile-level interaction model so future recommendation algorithms can be recalculated rather than relying only on aggregated counters.

Suggested event shape:

```text
ProfileInteractionEvent
- id
- profileId
- mediaType
- mediaId
- episodeId (nullable)
- eventType
- occurredAt
- positionMs (nullable)
- durationMs (nullable)
- shelfId / shelfConcept (nullable)
- deviceType (nullable)
- sourceId (nullable if useful)
- metadataJson (strictly bounded/sanitized)
```

Useful event types can include, where product behavior genuinely emits them:
- DETAIL_OPENED
- PLAY_STARTED
- PLAY_RESUMED
- PLAY_PAUSED
- PLAY_COMPLETED
- PLAY_ABANDONED
- MY_LIST_ADDED
- MY_LIST_REMOVED
- LIKED
- DISLIKED
- SEARCH_PERFORMED
- SEARCH_RESULT_OPENED
- SHELF_IMPRESSION
- SHELF_ITEM_OPENED
- PREVIEW_STARTED
- SOURCE_SELECTED

Do not generate noisy events every second. Keep playback position updates in the existing progress mechanism and emit interaction events at meaningful boundaries.

## 6. Derived taste profile
Prepare a profile-level derived preference model that can be recomputed from catalog metadata + interaction events.

Do not try to build the full recommendation engine in this ticket, but create a reusable place for derived weights/features, e.g.:
- genre affinity;
- actor/director/person affinity;
- language affinity;
- decade/year preference;
- movie vs series vs anime preference;
- runtime preference;
- completion/abandon tendencies;
- explicit likes/dislikes.

Prefer a design that allows recomputation/versioning when recommendation logic changes.

## 7. First-profile migration
Existing deployments currently behave as a single-user system.

Provide a safe migration:
- existing authenticated account becomes an Account;
- create one default profile from the existing user name or a neutral default;
- assign ALL existing personal state/progress/My List/history to that default profile;
- do not lose existing watch progress;
- do not require database reset.

Make migration idempotent/safe.

## 8. Shared vs profile-owned data boundary
Document and enforce the ownership split.

### Account/shared
Examples:
- Xtream/M3U/Plex source configuration;
- provider credentials/secrets;
- paired TV devices (unless product chooses profile-specific pairing later);
- account auth/security;
- household-level admin settings.

### Profile-specific
Examples:
- Home personalization;
- Continue Watching;
- watch history/progress;
- My List;
- likes/dislikes;
- language/subtitle preferences;
- autoplay/skip/never-stop preferences;
- recommendation signals;
- personal interactions.

## 9. Kids / maturity readiness
Do not build a full parental-control product yet, but make the Profile model compatible with a Kids profile / maturity restriction without future schema redesign.

Ensure APIs can later filter catalog/recommendations by profile maturity level.

## 10. Profile limits and lifecycle
Define sane product rules:
- configurable max profiles per account (e.g. 5 by default, not hard-coded in UI only);
- unique or non-unique names as product decides;
- deleting a profile requires confirmation at UI layer and should cascade personal state safely;
- prevent deleting the last profile unless replacement/default behavior exists;
- account always has at least one usable profile after migration.

## 11. Security
Critical requirements:
- authenticated account can only access its own profiles;
- switching profile cannot cross account boundary;
- profile IDs in URLs/payloads must be authorization-checked;
- account-level provider secrets are never exposed to profiles/clients unnecessarily;
- passwords remain handled by current secure auth flow.

## 12. API compatibility
Evolve APIs so profile context is implicit/consistent once selected.

Avoid requiring every frontend call to manually append `profileId` if the authenticated session can safely carry current profile context.

If some endpoints legitimately operate account-wide, make that explicit.

## 13. Tests
Add tests for:
- account -> multiple profiles;
- selecting current profile;
- cross-account profile access rejected;
- watch progress isolated by profile;
- My List isolated by profile;
- Continue Watching isolated by profile;
- audio/subtitle/autoplay settings isolated by profile;
- existing single-user migration to default profile;
- deleting a profile cleans only its personal state;
- source configuration remains shared;
- interaction event created under correct profile.

## Acceptance criteria
- [ ] First-class Account -> Profile relationship exists.
- [ ] Existing auth continues working.
- [ ] Existing users migrate to an Account with a default Profile without losing progress/history/list state.
- [ ] Current profile can be selected and securely resolved server-side.
- [ ] Watch progress is profile-scoped.
- [ ] Continue Watching is profile-scoped.
- [ ] My List is profile-scoped.
- [ ] Watched episode/movie state is profile-scoped.
- [ ] Playback/audio/subtitle/skip preferences are profile-scoped.
- [ ] Interaction events are stored by profile for future recommendation learning.
- [ ] Account-shared sources remain shared and are not duplicated per profile.
- [ ] Profiles from another account are inaccessible.
- [ ] Kids/maturity fields are future-compatible.
- [ ] No DB reset is required.

## Completion rule
Do not close because a `profiles` table exists. Demonstrate with one account containing at least two profiles that the same movie can simultaneously have different progress, My List state and preferences for each profile, and switching profiles returns the correct isolated state.