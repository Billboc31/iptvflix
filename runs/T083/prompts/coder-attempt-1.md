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


# T083 — Diagnose blank web UI after latest playback changes

**Source**: GitHub Issue #176

## Description

## Context
After the latest playback/cross-platform changes, the IPTVFlix web application now renders nothing / appears completely blank. This is a regression and currently prevents validating playback or the rest of the UI.

This ticket is primarily a DIAGNOSTIC + minimal recovery ticket: determine exactly why the web UI no longer renders, restore the application shell, and document the root cause. Do not hide the failure with a generic fallback without identifying the underlying regression.

## Goal
Restore the IPTVFlix web UI so Home/navigation/content render again, while identifying the exact commit/code path/runtime error that caused the blank screen.

## Required investigation

### 1. Reproduce the blank screen
Reproduce using the same production-like Railway deployment/configuration and also check local production build (`vite build` + production serving), not only Vite dev mode.

Record:
- deployed frontend commit SHA;
- deployed backend commit SHA if relevant;
- environment/build configuration;
- route opened;
- browser/device tested;
- whether HTML shell is returned;
- whether JS/CSS assets load successfully.

### 2. Browser diagnostics
Inspect browser console and network failures before changing code:
- uncaught JavaScript exceptions;
- React render/runtime errors;
- failed dynamic imports/chunks;
- 404/500 asset requests;
- API calls failing during application bootstrap;
- CORS/mixed-content errors;
- invalid environment variables;
- service-worker/cache issues if applicable.

Capture the FIRST exception/error that prevents rendering, including stack trace and component/module involved.

### 3. Check latest playback integration
The regression appeared after substantial playback compatibility/HLS work. Explicitly inspect whether recent playback changes introduced code that executes during global app initialization even when no player is open, for example:
- HLS/player library initialization;
- browser capability detection;
- imports incompatible with SSR/build/browser target;
- missing dependency/package;
- top-level access to unavailable browser APIs;
- malformed API client configuration;
- provider/context initialization;
- routing changes;
- hook errors;
- global playback session state.

Playback code should not be capable of crashing the entire browsing UI merely because media playback is unavailable.

### 4. Verify frontend production build
Run the actual workspace production checks and capture results:
- dependency install consistency / lockfile;
- TypeScript check;
- lint where configured;
- tests;
- Vite production build;
- production bundle serving.

A successful compile alone is not enough: load the built application in a browser and verify it renders.

### 5. Railway deployment verification
Verify the actual Railway web service is serving the intended fresh build rather than an old/partial artifact.

Check:
- root directory/workspace command;
- build command;
- start command;
- PORT binding;
- environment variables, especially API base URL;
- deployment logs;
- asset paths/base path;
- current deployed SHA.

### 6. API bootstrap resilience
If an API endpoint used on startup is failing, the entire React tree must not become blank. Determine whether Home/Profile/Sources/etc. errors are handled. Restore a visible shell and useful error/loading states where necessary without masking the backend failure.

### 7. Bisect/regression identification
Compare the last known-good UI commit/deployment with the current deployment. Use git history/diff/bisect or focused inspection to identify the smallest change that introduced the blank screen.

Document the responsible commit/PR/file(s) when determinable.

## Minimal correction
Once root cause is confirmed, implement the smallest correct fix required to restore rendering. Do not perform an unrelated UI rewrite in this ticket.

If the root cause belongs to #174 playback work, isolate playback initialization so the rest of IPTVFlix remains usable even if playback/HLS initialization fails.

## Observability / error boundary
Ensure a future catastrophic frontend render failure is diagnosable. If not already present, add an appropriate top-level error boundary / visible fatal-error state in production so users do not receive a completely blank page and developers receive a useful sanitized error signal.

Do not expose credentials or provider URLs.

## Acceptance criteria
- [ ] Root cause of the blank UI is identified with concrete browser/build/deployment evidence.
- [ ] The first blocking runtime/build/network error is documented.
- [ ] Current deployed commit SHA/config is verified.
- [ ] Production build is loaded and tested, not merely compiled.
- [ ] Home renders again.
- [ ] Top navigation renders again.
- [ ] Films and Series browsing can be opened again.
- [ ] A playback failure cannot blank/crash the entire application shell.
- [ ] Existing #174 playback work is preserved unless it is proven to be the cause and needs correction/isolation.
- [ ] Railway serves the intended current build and assets without blocking 404/500 errors.
- [ ] Startup API failures produce a visible recoverable/error state rather than an empty page.
- [ ] A top-level diagnostic/error boundary exists or equivalent protection is demonstrated.
- [ ] Relevant regression test is added where practical.

## Completion rule
Do not mark this ticket complete simply because CI/build passes. Verify that the deployed/production-built WebApp visibly renders real UI content again.