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


# T057 — Add Web 'Play on TV' device picker and remote handoff UX

**Source**: GitHub Issue #106

## Description

## Objective

Let a user choose a Movie/Episode on the IPTVFlix Web app from phone or desktop and hand playback off to a paired Android TV in one action.

## Product intent

The Web app remains the rich browsing/discovery interface. Android TV is a simple playback companion. The handoff should feel immediate: choose media on Web → `Play on TV` → select paired TV if needed → TV starts playback.

## Included

- Add a `Play on TV` action to relevant Movie/Episode detail/play surfaces once at least one paired playback device exists.
- Add a lightweight paired-device picker showing human-readable device names and online/last-seen state from #104.
- If exactly one suitable TV is paired, allow a fast one-tap handoff while still making the target visible/understandable.
- Send remote playback commands through the authenticated backend device-command API; do not attempt browser-to-TV direct network connections.
- Reuse the same canonical Movie/Episode identity and optional explicit Availability choice used by #99.
- Support `Play from beginning` and `Resume` semantics when stored progress exists.
- Show clear command lifecycle feedback in Web: sending, delivered/accepted, failed/expired, device offline.
- Add a simple device-management/pairing surface reachable from Web settings where the user can enter/approve the code shown on TV and rename/revoke devices.
- Preserve the normal `Play here` Web action; remote handoff is an additional playback target, not a replacement.
- Keep the interaction responsive on mobile Web so a phone is a practical remote/browsing companion.

## Acceptance Criteria

- [ ] Web can approve/pair a TV using the code/token flow from #104.
- [ ] Paired TVs are visible by friendly name and can be renamed/revoked.
- [ ] A Movie detail can send `Play on TV` to a selected paired TV.
- [ ] An Episode can be handed off with the correct canonical episode identity.
- [ ] Resume/from-start selection is preserved in the command.
- [ ] One paired device supports a low-friction one-tap handoff path.
- [ ] Offline/revoked/expired targets produce a clear UI state and do not silently succeed.
- [ ] Web still supports local Web playback independently.
- [ ] Frontend tests cover pairing approval, device selection, one-device fast path, resume handoff and offline/error states.

## Excluded / Out of scope

- Using the Web browser as a full remote-control surface for seek/volume after playback starts.
- Chromecast/Google Cast SDK integration.
- Full Android TV browsing interface.

## Dependencies

Depends on #104 device pairing/remote commands. Integrates with #99 playback semantics and #105 Android TV consumption.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 23 test files, 154 tests pass. Here's the implementation summary:

---

## Changes summary

**Files created:**
- `apps/web/src/hooks/useDevices.ts` — device list hook with `isDeviceOnline` utility (90s threshold), filtering revoked devices, `approve`/`rename`/`revoke` mutations
- `apps/web/src/hooks/usePlayOnTv.ts` — command dispatch hook returning `CommandState`, checks offline before calling API
- `apps/web/src/components/devices/DeviceListItem.tsx` — stateless device row with inline rename (keyboard-friendly) and revoke-with-confirmation
- `apps/web/src/components/devices/DevicePickerModal.tsx` — modal with fast-path (single device auto-sends, calls `onFastPath` callback), multi-device picker, resume/from-start toggle, inline status feedback, 1.5s auto-close on success
- `apps/web/src/pages/DeviceSettingsPage.tsx` — `/settings/devices` page with paired-device list and pairing form (validates code detail before approving, shows specific errors for expired/unknown)
- `apps/web/src/hooks/useDevices.test.ts` — unit tests for online classification and mutation callbacks
- `apps/web/src/components/devices/DevicePickerModal.test.tsx` — fast path, offline device disabled, resume toggle, success/error states
- `apps/web/src/pages/DeviceSettingsPage.test.tsx` — pairing approval, expired/unknown code errors, rename, revoke with confirmation

**Files modified:**
- `apps/web/src/lib/api.ts` — 6 new functions: `listDevices`, `getPairingCodeDetail`, `approvePairingCode`, `sendPlayOnTvCommand`, `renameDevice`, `revokeDevice`
- `apps/web/src/pages/MovieDetailPage.tsx` — "📺 Lire sur TV" button (hidden when no devices), `DevicePickerModal` with toast callbacks
- `apps/web/src/components/detail/EpisodeRow.tsx` — "📺 TV" button + `DevicePickerModal` per episode, `devices` prop (default `[]`)
- `apps/web/src/components/detail/SeasonAccordion.tsx` — threads `devices` prop to `EpisodeRow`
- `apps/web/src/pages/SeriesDetailPage.tsx` — `useDevices` + passes devices to `SeasonAccordion`
- `apps/web/src/App.tsx` — route `/settings/devices`
- `apps/web/src/components/layout/LeftNav.tsx` — "Appareils TV" nav link
- `apps/web/src/test/handlers.ts` — `MOCK_DEVICE_ONLINE`, `MOCK_DEVICE_OFFLINE`, `MOCK_PAIRING_CODE_DETAIL`, `MOCK_PLAY_COMMAND` + MSW handlers for all device endpoints
- `apps/web/src/components/detail/EpisodeRow.test.tsx` — fixed pre-existing missing `MemoryRouter`/`ToastProvider` wrappers

---

## Review

# PR Review — T057

## Résumé

L'implémentation couvre bien le scope : hooks `useDevices`/`usePlayOnTv`, composant `DevicePickerModal` (avec fast-path), `DeviceListItem`, `DeviceSettingsPage`, intégration dans les pages Movie/Series/EpisodeRow, route, navigation, et 3 fichiers de test. La structure est propre, les erreurs sont gérées explicitement.

**Un problème bloquant empêche la validation.**

---

## Problème bloquant — AC #5 : Resume/depuis le début inatteignable en production

Le toggle "Reprendre / Depuis le début" dans `DevicePickerModal` n'apparaît que quand `progressMs > 0`. Or **ni `MovieDetailPage` ni `EpisodeRow` ne passent jamais `progressMs`** au modal — la prop vaut toujours `0` (défaut).

**Cause racine** : `MovieDetailResponse` et `EpisodeResponse` ne contiennent pas la position de progression en millisecondes. `EpisodeResponse` expose seulement `watchState: 'in_progress' | 'watched' | ...` sans valeur numérique. Aucune requête complémentaire n'est faite.

**Conséquence** : le toggle n'est jamais affiché, `startPositionMs` n'est jamais envoyé. La fonctionnalité de reprise est du dead code en production, alors que le ticket l'exige explicitement (AC #5 : "Resume/from-start selection is preserved in the command").

Le test `shows resume toggle when progressMs > 0` passe uniquement parce qu'il injecte `progressMs={60000}` manuellement — il ne valide pas d'intégration réelle.

**Correction requise** : câbler la position réelle — soit en étendant les types `MovieDetailResponse`/`EpisodeResponse` avec `progressMs?: number` et en l'alimentant côté backend, soit en interrogeant l'endpoint user-state depuis les pages de détail et en passant la valeur au modal.

---

## Points mineurs

- **Plan §8** : le plan spécifie d'ajouter le lien "Appareils" dans `ProfileSettingsPage.tsx` ; l'implémentation l'a mis dans `LeftNav` seulement. Suggéré : ajouter le lien dans `ProfileSettingsPage` aussi.
- **Icône doublon** : 📺 utilisé à la fois pour "Séries" et "Appareils TV" dans `LeftNav`.
- **EpisodeRow** : aucun test ne couvre le bouton 📺 TV au niveau du composant `EpisodeRow`.

---

## Décision

**REQUEST_CHANGES** — le problème bloquant doit être résolu avant approbation.

La review est sauvegardée dans `runs/T057/reviews/review-T057.md`.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T057/reviews/implementation-review.md
- generated at: 2026-08-13T03:06:40Z

---

# PR Review — T057

## Résumé

L'implémentation couvre bien le scope : hooks `useDevices`/`usePlayOnTv`, composant `DevicePickerModal` (avec fast-path), `DeviceListItem`, `DeviceSettingsPage`, intégration dans les pages Movie/Series/EpisodeRow, route, navigation, et 3 fichiers de test. La structure est propre, les erreurs sont gérées explicitement.

**Un problème bloquant empêche la validation.**

---

## Problème bloquant — AC #5 : Resume/depuis le début inatteignable en production

Le toggle "Reprendre / Depuis le début" dans `DevicePickerModal` n'apparaît que quand `progressMs > 0`. Or **ni `MovieDetailPage` ni `EpisodeRow` ne passent jamais `progressMs`** au modal — la prop vaut toujours `0` (défaut).

**Cause racine** : `MovieDetailResponse` et `EpisodeResponse` ne contiennent pas la position de progression en millisecondes. `EpisodeResponse` expose seulement `watchState: 'in_progress' | 'watched' | ...` sans valeur numérique. Aucune requête complémentaire n'est faite.

**Conséquence** : le toggle n'est jamais affiché, `startPositionMs` n'est jamais envoyé. La fonctionnalité de reprise est du dead code en production, alors que le ticket l'exige explicitement (AC #5 : "Resume/from-start selection is preserved in the command").

Le test `shows resume toggle when progressMs > 0` passe uniquement parce qu'il injecte `progressMs={60000}` manuellement — il ne valide pas d'intégration réelle.

**Correction requise** : câbler la position réelle — soit en étendant les types `MovieDetailResponse`/`EpisodeResponse` avec `progressMs?: number` et en l'alimentant côté backend, soit en interrogeant l'endpoint user-state depuis les pages de détail et en passant la valeur au modal.

---

## Points mineurs

- **Plan §8** : le plan spécifie d'ajouter le lien "Appareils" dans `ProfileSettingsPage.tsx` ; l'implémentation l'a mis dans `LeftNav` seulement. Suggéré : ajouter le lien dans `ProfileSettingsPage` aussi.
- **Icône doublon** : 📺 utilisé à la fois pour "Séries" et "Appareils TV" dans `LeftNav`.
- **EpisodeRow** : aucun test ne couvre le bouton 📺 TV au niveau du composant `EpisodeRow`.

---

## Décision

**REQUEST_CHANGES** — le problème bloquant doit être résolu avant approbation.

La review est sauvegardée dans `runs/T057/reviews/review-T057.md`.

IMPLEMENTATION_FIX_REQUIRED