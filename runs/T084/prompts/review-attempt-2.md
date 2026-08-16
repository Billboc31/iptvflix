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

# Role — Reviewer

## Mission

Vérifier qu’une implémentation respecte :
- le ticket
- le plan
- les conventions
- l’architecture
- les contraintes sécurité/qualité

## Tu dois

- détecter les dérives de scope
- détecter les violations architecture
- vérifier les impacts potentiels
- vérifier la cohérence mémoire/documentation
- proposer des corrections concrètes

## Tu ne dois pas

- réécrire complètement le code
- introduire un nouveau scope
- accepter des comportements implicites dangereux

## Sortie attendue

Une review structurée conforme à `ai/templates/pr-review-template.md`.

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

# Generic Review Task

Read the ticket below and review the implementation produced for it.

The review must cover:
- correctness relative to the ticket requirements
- scope compliance
- code quality and safety
- blocking issues vs minor observations

The ticket follows.


# T084 — Repair blank-UI merge regression: restore playback, fix login, and clean generated artifacts

**Source**: GitHub Issue #178

## Description

## Context
T083/#177 successfully added useful blank-screen resilience, but its merge also reverted a large amount of already-merged T082 playback work and introduced additional regressions/artifacts.

Observed after T083:
- login/auth flow is now broken;
- much of the T082 HLS/playback compatibility architecture was removed/reverted;
- ffmpeg Railway setup was removed;
- generated `.js`, `.d.ts`, `.map`, `dist/` and cache artifacts were committed into the repository;
- the blank-screen fixes themselves are still desirable and should be preserved.

This ticket is a REPAIR ticket. Do not perform another broad rollback.

## Goal
Produce the intended combined state:

1. keep the legitimate T083 blank-screen resilience fixes;
2. restore the legitimate T082 playback/HLS implementation that T083 accidentally removed;
3. restore a working login/auth flow;
4. remove generated build/compiler/cache artifacts from source control;
5. verify the resulting production web app actually renders and authenticates.

## Source-of-truth strategy
Use git history deliberately.

Compare at least:
- T082 merge commit: `2fee2c45243d0fbe9c1c0d331545ebe10f28a040`
- T083 merge commit: `164574f10cae377b846528e46ea24baa7a97b625`

Do NOT blindly revert T083, because T083 contains valid fixes.

Do NOT blindly cherry-pick all of T082 on top either, because conflicts must preserve the intended T083 resilience changes.

Reconstruct the correct final state file-by-file.

## T083 fixes that should be preserved
Unless proven incorrect, preserve the T083-specific resilience improvements:
- top-level `ErrorBoundary` and its integration in `App.tsx`;
- `PreviewContext` guard around `matchMedia` / unsupported browser APIs;
- `ProtectedRoute` visible loading/spinner behavior;
- `AuthContext` defensive error handling where it does not break login semantics;
- relevant test setup/browser API mocks;
- test-handler/search fixes that were genuinely part of T083;
- graceful visible failure instead of completely blank UI.

## Restore T082 playback architecture
T083 removed/reverted already-merged T082 work. Restore the sound T082 pieces, including where applicable:
- playback gateway/routes;
- `hls-session-store`;
- `media-prober`;
- playback compatibility classification;
- playback session store;
- probe cache;
- playback resolver changes;
- HLS/remux/transcode support;
- API contract fields required by the T082 player architecture (`gatewayUrl`, `deliveryMode`, or their current intended equivalents);
- frontend `usePlayback` integration;
- player page/player controls;
- progress integration;
- playback e2e/integration tests;
- ffmpeg/ffprobe Railway/Nixpacks runtime configuration.

Do not restore code mechanically if T082 itself has an independently proven defect; document any intentional deviation.

## Fix login/auth regression — BLOCKING
Login worked before this regression and is now reported broken after T083.

Trace the auth flow end-to-end:

```text
Login form
  → auth API request
  → response/token/device/session state
  → AuthContext state
  → ProtectedRoute
  → app shell/home
```

Inspect specifically the T083 `AuthContext` and `ProtectedRoute` changes for altered loading/authenticated/error semantics.

Verify:
- login form actually sends the intended request;
- valid credentials/session result in authenticated state;
- token/device/session persistence is unchanged unless deliberately migrated;
- refresh/reload restores authentication correctly;
- failed login shows an explicit error;
- an API/bootstrap error is not misinterpreted as permanent unauthenticated state;
- `ProtectedRoute` does not loop, remain stuck on spinner, redirect incorrectly, or swallow auth state;
- logout still works.

The ticket is not complete until login is manually exercised against a production-like backend.

## Remove generated artifacts from git
T083 introduced a large number of generated files into source control, including examples such as:
- `apps/web/src/**/*.js`
- `apps/web/src/**/*.js.map`
- `apps/web/src/**/*.d.ts`
- `apps/web/src/**/*.d.ts.map`
- `apps/web/dist/**`
- `node_modules/.vite/**`
- test cache/result files.

Remove generated artifacts that are not intentional source files.

Update `.gitignore` and/or TypeScript build configuration as necessary so normal test/build commands do not re-add them.

Source directories should contain source files, not compiler output, unless a specific repository convention explicitly requires otherwise.

## Production build cleanliness
Verify the actual intended build pipeline:
- TypeScript check;
- web tests;
- API tests relevant to auth/playback;
- Vite production build;
- production static serving;
- Railway frontend startup;
- Railway API runtime including ffmpeg/ffprobe if required.

Do not commit `dist` merely to make Railway work. Fix deployment/build configuration instead.

## Regression tests
Add/restore tests covering at minimum:
- app shell survives a provider/playback/bootstrap error;
- login success transitions through `AuthContext` + `ProtectedRoute` into the authenticated app;
- login failure is visible and recoverable;
- refresh with valid auth remains authenticated;
- playback API contract expected by the frontend matches backend responses;
- HLS/playback modules are present and reachable after repair;
- no generated source-tree compiler artifacts are produced/tracked by normal tests/build.

## Manual smoke test — BLOCKING
After merge/deployment, manually validate:
1. web app visibly renders;
2. login works;
3. page refresh while logged in works;
4. Home loads;
5. Films loads;
6. Series loads;
7. opening a media detail works;
8. clicking `Regarder` reaches the restored T082 playback pipeline;
9. a playback failure, if any, produces a player/error state without blanking the whole app.

## Acceptance criteria
- [ ] T083 valid ErrorBoundary/blank-screen resilience is preserved.
- [ ] T082 playback/HLS architecture accidentally removed by T083 is restored.
- [ ] ffmpeg/ffprobe production configuration required by playback is restored.
- [ ] Login works end-to-end again.
- [ ] Auth state survives a browser refresh as intended.
- [ ] Failed login shows a useful error rather than a blank page/stuck spinner.
- [ ] `ProtectedRoute` transitions correctly through loading/authenticated/unauthenticated states.
- [ ] Generated `.js`, `.map`, `.d.ts`, `dist/`, Vite cache/test artifacts are removed from git when not intentional.
- [ ] `.gitignore`/build configuration prevents those artifacts from returning.
- [ ] Production Vite build renders successfully when served.
- [ ] Home / Films / Series are manually verified after deployment.
- [ ] Playback button reaches the restored gateway/HLS path.
- [ ] Playback errors cannot crash/blank the entire application.
- [ ] API/frontend playback contracts are consistent.
- [ ] Relevant auth, resilience, and playback regression tests pass.

## Completion rule
Do not mark this ticket complete solely because unit tests/builds pass. A production-like manual smoke test of BOTH login and authenticated UI rendering is mandatory. If the worker cannot perform that environment-level check, explicitly report `awaiting manual login/UI validation` rather than claiming the regression is fixed.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
