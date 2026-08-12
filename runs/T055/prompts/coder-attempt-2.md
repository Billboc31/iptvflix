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


# T055 — Add secure TV device pairing and remote playback command channel

**Source**: GitHub Issue #104

## Description

## Objective

Add the backend/device foundation that lets an IPTVFlix Android TV app pair securely with the current single-user account and receive remote playback commands from the Web app.

## Product intent

The Android TV client should remain simple. Browsing/choosing content can happen on phone/desktop Web, while the TV acts as a trusted playback target. A user should be able to pair the TV once, then choose a Movie/Episode on Web and send it to that TV.

## Included

- Add a first-class `Device` / playback-target model scoped to the current authenticated IPTVFlix account/profile.
- Implement short-lived TV pairing codes and/or QR-friendly pairing tokens.
- TV can request a pairing code while unauthenticated; an authenticated Web session can approve it.
- After approval, issue a revocable device credential/token suitable for storage on Android TV.
- Add APIs to list, rename and revoke paired devices.
- Add a secure server-side command model for remote playback intents, including at minimum:
  - target device id;
  - canonical Movie/Episode identity;
  - optional explicit Availability id;
  - resume/start position semantics;
  - command id / createdAt / expiry / state.
- Provide a bounded realtime delivery mechanism suitable for Railway + Android TV (WebSocket, SSE/long-poll or equivalent chosen by the Planner) so the TV receives commands quickly without client-to-client direct networking.
- Persist command state enough to survive reconnects/restarts and avoid duplicate playback from the same command.
- Commands must be authenticated/authorized and only deliver to the paired target device.
- Keep provider credentials out of remote-command payloads; the TV should resolve playback through the backend playback boundary from #99.
- Expose device online/last-seen state where practical without requiring a complex presence subsystem.

## Acceptance Criteria

- [ ] A fresh TV can display a short pairing code/QR-compatible token without exposing account secrets.
- [ ] An authenticated Web user can approve pairing and the TV receives a durable revocable device credential.
- [ ] Paired devices can be listed, renamed and revoked from Web/API.
- [ ] A remote playback command can target exactly one paired TV.
- [ ] The target TV can receive the command within a few seconds under normal connectivity.
- [ ] Reconnect/retry does not cause the same command to launch repeatedly.
- [ ] Expired/revoked device credentials cannot receive or acknowledge commands.
- [ ] Command payloads contain canonical/playback-resolution references, not raw Xtream/Plex credentials.
- [ ] Automated tests cover pairing approval, invalid/expired code, device revocation, command authorization, delivery and deduplication.

## Excluded / Out of scope

- Android TV UI/player implementation itself.
- Chromecast/Google Cast protocol compatibility.
- Multi-household accounts.
- Remote volume/TV power control.

## Dependencies

Should integrate with #95 hosted authentication and #99 secure playback resolution. The pairing protocol can be developed in parallel while those contracts settle.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Implementation complete. Here's a summary:

## Changes

**38 test files pass, 537 tests green. TypeScript build clean.**

### Files created/modified

**Schema** (`apps/api/src/db/schema/`):
- `devices.ts` — `devices` + `pairing_codes` tables with `pairingCodeStatusEnum`
- `playback-commands.ts` — `playback_commands` table with `playbackMediaTypeEnum` + `commandStateEnum`
- `index.ts` — added exports for both new schema files

**Migration**:
- `apps/api/migrations/0021_tv_pairing_commands.sql` — auto-generated by `drizzle-kit generate`
- `apps/api/migrations/meta/_journal.json` — trailing-comma fix + new entry for `0021`

**API contracts** (`packages/api-contracts/src/`):
- `device.ts` — `PairingCodeResponse`, `PairingStatusResponse`, `DeviceResponse`, `PlaybackCommandRequest`, `PlaybackCommandResponse`
- `index.ts` — added `device.ts` export

**Lib** (`apps/api/src/lib/`):
- `device-events.ts` — in-process `EventEmitter` singleton; `emitCommandForDevice` / `onCommandForDevice`

**Middleware** (`apps/api/src/middleware/`):
- `authenticateDevice.ts` — SHA-256 token lookup, revocation check, `lastSeenAt` update

**Services** (`apps/api/src/services/`):
- `pairing.service.ts` — code generation (8-char alphanumeric), 5-min TTL, approval flow + token issuance
- `device.service.ts` — list / rename / revoke
- `command.service.ts` — create (emits SSE event), get-pending (marks delivered, expires stale), acknowledge (idempotent)

**Routes** (`apps/api/src/routes/`):
- `pairing.ts` — `POST /pairing/codes`, `GET /pairing/codes/:code/status` (30s long-poll), `GET /pairing/codes/:code`, `POST /pairing/codes/:code/approve`
- `devices.ts` — `GET /devices`, `PATCH /devices/:id`, `DELETE /devices/:id`
- `commands.ts` — `POST /devices/:id/commands`, `GET /devices/me/commands/stream` (SSE + heartbeat), `GET /devices/me/commands`, `POST /devices/me/commands/:commandId/ack`
- `index.ts` — registered `pairingRoutes`, `devicesRoutes`, `commandsRoutes`

**Tests**:
- `pairing.test.ts` — 9 tests (code creation, approval, expiry, no credential leakage)
- `devices.test.ts` — 7 tests (list, rename, revoke, 404 paths)
- `commands.test.ts` — 14 tests (create, auth, 401/403/404 paths, deduplication, SSE auth)

---

## Review

IMPLEMENTATION_FIX_REQUIRED

---

## Résumé de la review T055

L'implémentation est structurellement solide (routes enregistrées, middleware de device auth correct, SSE propre, schéma cohérent avec les UUIDs du catalogue). Deux bugs bloquants ont été identifiés :

**[BLOQUANT 1] — Le token n'atteint jamais la TV**
`getPairingStatus` retourne `deviceToken: undefined` (ligne 60 de `pairing.service.ts`). Le token plain-text est généré dans `approvePairingCode` et rendu à la Web app, mais n'est pas stocké en DB. La TV qui sonde son code de pairing reçoit `{ status: 'approved', deviceToken: undefined }` — elle ne peut pas s'authentifier. Le flow de pairing est non-fonctionnel de bout en bout.

**[BLOQUANT 2] — Aucune auth Web sur les routes d'approbation/gestion**
`POST /pairing/codes/:code/approve`, `GET/PATCH/DELETE /devices/*` et `POST /devices/:id/commands` sont ouverts sans aucune vérification d'identité. N'importe quel client peut approuver un pairing code en cours et voler le device token. Violates the ticket AC : *"An authenticated Web user can approve pairing"*.

**Actions obligatoires :**
1. Ajouter une colonne `device_token` dans `pairing_codes` pour stocker le token temporairement et le retourner via `getPairingStatus`.
2. Ajouter un guard d'auth Web minimal sur les routes d'approbation et de gestion (même provisoire en attendant #95).

**Points significatifs recommandés :**
- `getPendingCommands` retourne `state: 'pending'` même après transition vers `delivered` en DB (stale data).
- Test manquant : "revoked device cannot authenticate" (critère d'acceptation du ticket).

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T055/reviews/implementation-review.md
- generated at: 2026-08-12T23:36:03Z

---

IMPLEMENTATION_FIX_REQUIRED

---

## Résumé de la review T055

L'implémentation est structurellement solide (routes enregistrées, middleware de device auth correct, SSE propre, schéma cohérent avec les UUIDs du catalogue). Deux bugs bloquants ont été identifiés :

**[BLOQUANT 1] — Le token n'atteint jamais la TV**
`getPairingStatus` retourne `deviceToken: undefined` (ligne 60 de `pairing.service.ts`). Le token plain-text est généré dans `approvePairingCode` et rendu à la Web app, mais n'est pas stocké en DB. La TV qui sonde son code de pairing reçoit `{ status: 'approved', deviceToken: undefined }` — elle ne peut pas s'authentifier. Le flow de pairing est non-fonctionnel de bout en bout.

**[BLOQUANT 2] — Aucune auth Web sur les routes d'approbation/gestion**
`POST /pairing/codes/:code/approve`, `GET/PATCH/DELETE /devices/*` et `POST /devices/:id/commands` sont ouverts sans aucune vérification d'identité. N'importe quel client peut approuver un pairing code en cours et voler le device token. Violates the ticket AC : *"An authenticated Web user can approve pairing"*.

**Actions obligatoires :**
1. Ajouter une colonne `device_token` dans `pairing_codes` pour stocker le token temporairement et le retourner via `getPairingStatus`.
2. Ajouter un guard d'auth Web minimal sur les routes d'approbation et de gestion (même provisoire en attendant #95).

**Points significatifs recommandés :**
- `getPendingCommands` retourne `state: 'pending'` même après transition vers `delivered` en DB (stale data).
- Test manquant : "revoked device cannot authenticate" (critère d'acceptation du ticket).