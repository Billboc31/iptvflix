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

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Committed as `12aa72f`. The T098 implementation is complete:

**36 files changed, 1491 insertions / 104 deletions** across:
- 10 new files: `accounts.ts` schema, `profile-interaction-events.ts` schema, `seed.ts`, `profiles.ts` route, `interaction-events.ts` route, `interaction-event-service.ts`, migration `0035`, `profiles.test.ts`, `account.ts` contract, `interaction-events.ts` contract
- 26 modified files: all personalization routes migrated from `DEFAULT_PROFILE_ID` to `request.profileId!`, auth plugin extended with two-step JWT, profile-service rewritten with full CRUD, test fixtures updated with `preHandler` hooks

---

## Review

J'ai maintenant tous les éléments pour la review. Voici mon analyse complète.

---

# PR Review — T098 Account → Profile Foundation

## Résumé

Implémentation d'une fondation Account → Profile : 36 fichiers, 1 491 insertions. Les nouveaux schémas, l'API CRUD profile, le seed idempotent, la migration des routes personnalisées et le store d'interaction events sont en place. La structure générale est solide, mais deux vulnérabilités de sécurité bloquantes ont été identifiées sur les routes `/home` et `/recommendations`.

---

## Vérifications effectuées

- Schémas `accounts`, `profiles` (étendu), `profile_interaction_events` + migration SQL
- Auth middleware (`plugins/auth.ts`) — décodage JWT, vérification ownership profile
- Toutes les routes personnalisées (`watchlist`, `viewing-progress`, `feedback`, `shelves`, `taste`, `profile`, `profiles`, `interaction-events`, `home`, `recommendations`)
- Service `profile-service.ts` — CRUD complet, limites, delete guards
- Seed idempotent `db/seed.ts`
- Câblage `index.ts` — scope `protectedScope` vs `profileScope`
- Contrats API (`packages/api-contracts`)
- Tests `profiles.test.ts`

---

## Points validés

**Schéma et migration**
- `accounts` table correcte : `id`, `username`, `passwordHash`, `email`, `maxProfiles`, timestamps.
- `profiles` étendu : `accountId` (FK cascade), `isKids`, `maturityLevel`, `avatarKey`, `autoplayNextEpisode`, `autoSkipIntro`, `autoSkipRecap`, `neverStopMode`, `subtitlesEnabledPreference`, `preferredUiLanguage`, `lastUsedAt`, `updatedAt` — tous présents.
- `profile_interaction_events` : schéma conforme au ticket, index sur `(profileId, occurredAt DESC)`, FK cascade.
- Migration SQL : `IF NOT EXISTS` sur chaque `ALTER TABLE` — sûre sur une DB live, pas de destruction de données.

**Auth à deux niveaux**
- JWT login : `{ accountId, username }` — pas de profileId à ce stade.
- JWT post-select : `{ accountId, username, profileId }`.
- `authenticate` middleware : décode le JWT, vérifie en DB que `profiles.accountId = accountId` pour chaque requête portant un profileId — protection correcte contre les tokens obsolètes.
- `requireProfile` middleware : renvoie 403 `PROFILE_NOT_SELECTED` si pas de profileId en session.

**CRUD profile**
- `listProfiles` : filtre par `accountId` ✓
- `createProfile` : vérifie `maxProfiles` via DB, retourne 409 ✓
- `updateProfile` : ownership check `WHERE id AND accountId` ✓
- `deleteProfile` : guards last-profile et current-profile ✓
- `selectProfile` : ownership check + `lastUsedAt` ✓

**Routes personnalisées migrées**
- `watchlist`, `viewing-progress`, `feedback`, `shelves`, `taste`, `profile`, `interaction-events` : toutes utilisent `request.profileId!` — `DEFAULT_PROFILE_ID` absent de ces fichiers.

**Seed idempotent**
- Logique en trois étapes : compte déjà existant → skip, profil legacy non lié → lier, aucun profil → créer. Safe à chaque redémarrage.

**Tests**
- Limite maxProfiles (409) ✓
- Protection dernier profil (409) ✓
- Rejet cross-account sur `/select` (403) ✓
- Isolation watch progress (service level) ✓
- Isolation watchlist (deux apps séparées) ✓
- Isolation préférences ✓
- Interaction events : 204 succès, 400 eventType inconnu ✓
- Seed idempotent : 3 scénarios couverts ✓

**Contrats API**
- `ProfileResponse`, `CreateProfileBody`, `UpdateProfileBody`, `SelectProfileResponse` ✓
- `InteractionEventBody`, `InteractionEventType` ✓

---

## Problèmes détectés

### 🔴 BLOQUANT — Sécurité : `home.ts` — profileId depuis l'URL sans vérification d'ownership

**Fichier** : `apps/api/src/routes/home.ts:7-9`

```typescript
app.get('/profiles/:profileId/home', async (request, reply) => {
  const { profileId } = request.params   // ← vient du client, jamais vérifié
  const result = await buildHome(profileId)
```

La route est dans `protectedScope` (JWT requis) mais **pas** dans `profileScope`. N'importe quel utilisateur authentifié peut passer un `profileId` arbitraire et lire le contenu Home d'un profil appartenant à un autre compte.

**Violation directe de §11** : *"profile IDs in URLs/payloads must be authorization-checked"* et *"authenticated account can only access its own profiles"*.

**Fix attendu** : Vérifier que `profileId` appartient à `request.account.id` avant d'appeler `buildHome`. Soit via `selectProfile`/`getCurrentProfile`, soit en passant `request.account.id` à `buildHome`. Alternative : passer la route dans `profileScope` et utiliser `request.profileId`.

---

### 🔴 BLOQUANT — Sécurité : `recommendations.ts` — profileId depuis l'URL sans vérification d'ownership

**Fichier** : `apps/api/src/routes/recommendations.ts:15,28`

```typescript
app.get('/profiles/:profileId/recommendations', async (request, reply) => {
  const { profileId } = request.params   // ← vient du client, jamais vérifié
  const result = await rankRecommendations(profileId, ...)
```

Même vulnérabilité. Compte A peut accéder aux recommendations calculées sur les goûts du profil B appartenant au compte B.

**Fix attendu** : Idem — ownership check ou passage dans `profileScope` avec `request.profileId`.

---

### 🟡 MINEUR — `profile.ts` : erreur retourne HTTP 500 au lieu de 404

**Fichier** : `apps/api/src/routes/profile.ts:13-16`

```typescript
} catch {
  return reply.status(500).send({ error: 'Profile not found' })
}
```

Un profil introuvable (ex. : token corrompu) renvoie une 500, ce qui simule une erreur serveur interne. Devrait être 403 ou 404.

---

### 🟡 MINEUR — `DEFAULT_PROFILE_ID` et aliases compat toujours exportés

**Fichier** : `apps/api/src/services/profile-service.ts:235-249`

```typescript
export const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'
export async function getDefaultProfilePreferences() { ... }
export async function getDefaultProfile() { ... }
export async function updateDefaultProfilePreferences() { ... }
```

Le plan indiquait "remove DEFAULT_PROFILE_ID export". Ces exports sont du dead code (aucune route de production ne les importe). Laissés en place comme compat shim, mais ils maintiennent la possibilité de contourner accidentellement le profileId de session.

---

### 🟡 MINEUR — `profiles.accountId` reste nullable en DB, pas de migration NOT NULL

La colonne `account_id` est ajoutée nullable. Le plan prévoyait de déférer la contrainte NOT NULL après seed. Il n'existe pas de migration suivante pour ajouter cette contrainte. Toute insertion directe en DB peut créer un profil orphelin non visible par aucun compte.

---

### 🟡 MINEUR — Gaps de tests

- Pas de test vérifiant que la suppression d'un profil **ne touche pas les données du profil sibling** (la cascade DB est correcte mais non couverte).
- Pas de test vérifiant que **la configuration source reste partagée** (invariant §8 non testé).
- Le test d'isolation des préférences vérifie que `mockDb.update` est appelé une fois, mais ne compare pas deux profils côte à côte.

---

### 🟡 MINEUR — `metadataJson` non borné

**Fichier** : `apps/api/src/services/interaction-event-service.ts:39`

Le ticket demande "strictly bounded/sanitized". Aucune validation de taille ou de profondeur sur `metadataJson`. Risque de stockage de payloads arbitrairement larges.

---

## Risques éventuels

- L'authentification à deux niveaux (login sans profileId, select avec profileId) est un pattern inhabituel pour les clients frontend. Si le client oublie de `POST /profiles/:id/select` après login, toutes les routes profile-scoped retournent 403 — assez invisible pour déboguer. Un message d'erreur structuré avec `code: 'PROFILE_NOT_SELECTED'` est déjà en place — correct.
- Stale token avec un profileId supprimé : `authenticate` silently drop `request.profileId`, l'utilisateur reçoit 403 sans message explicite sur la raison. Acceptable mais pourrait être amélioré.

---

## Décision

REQUEST_CHANGES — deux vulnérabilités de sécurité bloquantes (cross-account profile access sur `/home` et `/recommendations`) doivent être corrigées avant merge.

---

## Actions demandées

1. **[BLOQUANT]** `apps/api/src/routes/home.ts` — Ajouter une vérification d'ownership du `profileId` paramètre avant d'appeler `buildHome`. Passer `request.account.id` et vérifier que le profil lui appartient, ou déplacer la route dans `profileScope` et utiliser `request.profileId`.

2. **[BLOQUANT]** `apps/api/src/routes/recommendations.ts` — Même correction : vérifier que `profileId` appartient à `request.account.id` avant d'appeler `rankRecommendations`.

3. **[MINEUR]** `apps/api/src/routes/profile.ts:13` — Changer `reply.status(500)` en `reply.status(404)` (ou 403) sur profil introuvable.

4. **[MINEUR]** Supprimer `DEFAULT_PROFILE_ID`, `getDefaultProfile`, `getDefaultProfilePreferences`, `updateDefaultProfilePreferences` de `profile-service.ts` ou les marquer `@deprecated` avec un lint rule pour éviter les régressions.

5. **[RECOMMANDÉ]** Ajouter une migration pour contraindre `profiles.account_id NOT NULL` une fois le seed initial garanti.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T098/reviews/implementation-review.md
- generated at: 2026-08-18T08:11:27Z

---

J'ai maintenant tous les éléments pour la review. Voici mon analyse complète.

---

# PR Review — T098 Account → Profile Foundation

## Résumé

Implémentation d'une fondation Account → Profile : 36 fichiers, 1 491 insertions. Les nouveaux schémas, l'API CRUD profile, le seed idempotent, la migration des routes personnalisées et le store d'interaction events sont en place. La structure générale est solide, mais deux vulnérabilités de sécurité bloquantes ont été identifiées sur les routes `/home` et `/recommendations`.

---

## Vérifications effectuées

- Schémas `accounts`, `profiles` (étendu), `profile_interaction_events` + migration SQL
- Auth middleware (`plugins/auth.ts`) — décodage JWT, vérification ownership profile
- Toutes les routes personnalisées (`watchlist`, `viewing-progress`, `feedback`, `shelves`, `taste`, `profile`, `profiles`, `interaction-events`, `home`, `recommendations`)
- Service `profile-service.ts` — CRUD complet, limites, delete guards
- Seed idempotent `db/seed.ts`
- Câblage `index.ts` — scope `protectedScope` vs `profileScope`
- Contrats API (`packages/api-contracts`)
- Tests `profiles.test.ts`

---

## Points validés

**Schéma et migration**
- `accounts` table correcte : `id`, `username`, `passwordHash`, `email`, `maxProfiles`, timestamps.
- `profiles` étendu : `accountId` (FK cascade), `isKids`, `maturityLevel`, `avatarKey`, `autoplayNextEpisode`, `autoSkipIntro`, `autoSkipRecap`, `neverStopMode`, `subtitlesEnabledPreference`, `preferredUiLanguage`, `lastUsedAt`, `updatedAt` — tous présents.
- `profile_interaction_events` : schéma conforme au ticket, index sur `(profileId, occurredAt DESC)`, FK cascade.
- Migration SQL : `IF NOT EXISTS` sur chaque `ALTER TABLE` — sûre sur une DB live, pas de destruction de données.

**Auth à deux niveaux**
- JWT login : `{ accountId, username }` — pas de profileId à ce stade.
- JWT post-select : `{ accountId, username, profileId }`.
- `authenticate` middleware : décode le JWT, vérifie en DB que `profiles.accountId = accountId` pour chaque requête portant un profileId — protection correcte contre les tokens obsolètes.
- `requireProfile` middleware : renvoie 403 `PROFILE_NOT_SELECTED` si pas de profileId en session.

**CRUD profile**
- `listProfiles` : filtre par `accountId` ✓
- `createProfile` : vérifie `maxProfiles` via DB, retourne 409 ✓
- `updateProfile` : ownership check `WHERE id AND accountId` ✓
- `deleteProfile` : guards last-profile et current-profile ✓
- `selectProfile` : ownership check + `lastUsedAt` ✓

**Routes personnalisées migrées**
- `watchlist`, `viewing-progress`, `feedback`, `shelves`, `taste`, `profile`, `interaction-events` : toutes utilisent `request.profileId!` — `DEFAULT_PROFILE_ID` absent de ces fichiers.

**Seed idempotent**
- Logique en trois étapes : compte déjà existant → skip, profil legacy non lié → lier, aucun profil → créer. Safe à chaque redémarrage.

**Tests**
- Limite maxProfiles (409) ✓
- Protection dernier profil (409) ✓
- Rejet cross-account sur `/select` (403) ✓
- Isolation watch progress (service level) ✓
- Isolation watchlist (deux apps séparées) ✓
- Isolation préférences ✓
- Interaction events : 204 succès, 400 eventType inconnu ✓
- Seed idempotent : 3 scénarios couverts ✓

**Contrats API**
- `ProfileResponse`, `CreateProfileBody`, `UpdateProfileBody`, `SelectProfileResponse` ✓
- `InteractionEventBody`, `InteractionEventType` ✓

---

## Problèmes détectés

### 🔴 BLOQUANT — Sécurité : `home.ts` — profileId depuis l'URL sans vérification d'ownership

**Fichier** : `apps/api/src/routes/home.ts:7-9`

```typescript
app.get('/profiles/:profileId/home', async (request, reply) => {
  const { profileId } = request.params   // ← vient du client, jamais vérifié
  const result = await buildHome(profileId)
```

La route est dans `protectedScope` (JWT requis) mais **pas** dans `profileScope`. N'importe quel utilisateur authentifié peut passer un `profileId` arbitraire et lire le contenu Home d'un profil appartenant à un autre compte.

**Violation directe de §11** : *"profile IDs in URLs/payloads must be authorization-checked"* et *"authenticated account can only access its own profiles"*.

**Fix attendu** : Vérifier que `profileId` appartient à `request.account.id` avant d'appeler `buildHome`. Soit via `selectProfile`/`getCurrentProfile`, soit en passant `request.account.id` à `buildHome`. Alternative : passer la route dans `profileScope` et utiliser `request.profileId`.

---

### 🔴 BLOQUANT — Sécurité : `recommendations.ts` — profileId depuis l'URL sans vérification d'ownership

**Fichier** : `apps/api/src/routes/recommendations.ts:15,28`

```typescript
app.get('/profiles/:profileId/recommendations', async (request, reply) => {
  const { profileId } = request.params   // ← vient du client, jamais vérifié
  const result = await rankRecommendations(profileId, ...)
```

Même vulnérabilité. Compte A peut accéder aux recommendations calculées sur les goûts du profil B appartenant au compte B.

**Fix attendu** : Idem — ownership check ou passage dans `profileScope` avec `request.profileId`.

---

### 🟡 MINEUR — `profile.ts` : erreur retourne HTTP 500 au lieu de 404

**Fichier** : `apps/api/src/routes/profile.ts:13-16`

```typescript
} catch {
  return reply.status(500).send({ error: 'Profile not found' })
}
```

Un profil introuvable (ex. : token corrompu) renvoie une 500, ce qui simule une erreur serveur interne. Devrait être 403 ou 404.

---

### 🟡 MINEUR — `DEFAULT_PROFILE_ID` et aliases compat toujours exportés

**Fichier** : `apps/api/src/services/profile-service.ts:235-249`

```typescript
export const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'
export async function getDefaultProfilePreferences() { ... }
export async function getDefaultProfile() { ... }
export async function updateDefaultProfilePreferences() { ... }
```

Le plan indiquait "remove DEFAULT_PROFILE_ID export". Ces exports sont du dead code (aucune route de production ne les importe). Laissés en place comme compat shim, mais ils maintiennent la possibilité de contourner accidentellement le profileId de session.

---

### 🟡 MINEUR — `profiles.accountId` reste nullable en DB, pas de migration NOT NULL

La colonne `account_id` est ajoutée nullable. Le plan prévoyait de déférer la contrainte NOT NULL après seed. Il n'existe pas de migration suivante pour ajouter cette contrainte. Toute insertion directe en DB peut créer un profil orphelin non visible par aucun compte.

---

### 🟡 MINEUR — Gaps de tests

- Pas de test vérifiant que la suppression d'un profil **ne touche pas les données du profil sibling** (la cascade DB est correcte mais non couverte).
- Pas de test vérifiant que **la configuration source reste partagée** (invariant §8 non testé).
- Le test d'isolation des préférences vérifie que `mockDb.update` est appelé une fois, mais ne compare pas deux profils côte à côte.

---

### 🟡 MINEUR — `metadataJson` non borné

**Fichier** : `apps/api/src/services/interaction-event-service.ts:39`

Le ticket demande "strictly bounded/sanitized". Aucune validation de taille ou de profondeur sur `metadataJson`. Risque de stockage de payloads arbitrairement larges.

---

## Risques éventuels

- L'authentification à deux niveaux (login sans profileId, select avec profileId) est un pattern inhabituel pour les clients frontend. Si le client oublie de `POST /profiles/:id/select` après login, toutes les routes profile-scoped retournent 403 — assez invisible pour déboguer. Un message d'erreur structuré avec `code: 'PROFILE_NOT_SELECTED'` est déjà en place — correct.
- Stale token avec un profileId supprimé : `authenticate` silently drop `request.profileId`, l'utilisateur reçoit 403 sans message explicite sur la raison. Acceptable mais pourrait être amélioré.

---

## Décision

REQUEST_CHANGES — deux vulnérabilités de sécurité bloquantes (cross-account profile access sur `/home` et `/recommendations`) doivent être corrigées avant merge.

---

## Actions demandées

1. **[BLOQUANT]** `apps/api/src/routes/home.ts` — Ajouter une vérification d'ownership du `profileId` paramètre avant d'appeler `buildHome`. Passer `request.account.id` et vérifier que le profil lui appartient, ou déplacer la route dans `profileScope` et utiliser `request.profileId`.

2. **[BLOQUANT]** `apps/api/src/routes/recommendations.ts` — Même correction : vérifier que `profileId` appartient à `request.account.id` avant d'appeler `rankRecommendations`.

3. **[MINEUR]** `apps/api/src/routes/profile.ts:13` — Changer `reply.status(500)` en `reply.status(404)` (ou 403) sur profil introuvable.

4. **[MINEUR]** Supprimer `DEFAULT_PROFILE_ID`, `getDefaultProfile`, `getDefaultProfilePreferences`, `updateDefaultProfilePreferences` de `profile-service.ts` ou les marquer `@deprecated` avec un lint rule pour éviter les régressions.

5. **[RECOMMANDÉ]** Ajouter une migration pour contraindre `profiles.account_id NOT NULL` une fois le seed initial garanti.

IMPLEMENTATION_FIX_REQUIRED