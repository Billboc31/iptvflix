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

## Output précédent

Implementation complete. Here's the summary:

---

**T084 committed** (`29df29e`) — 493 files changed.

**What was done:**
- Purged 465 generated `.js`/`.d.ts`/`dist/` files committed by T083 (root cause of blank UI regression)
- Restored full T082 HLS/DIRECT playback pipeline: `hls-session-store`, `media-prober`, `playback-compat`, `playback-session-store`, `probe-cache`, `playback.ts` gateway (5 endpoints), `playback-resolver.ts`
- Restored T082 API contracts (`gatewayUrl`/`deliveryMode` instead of `streamUrl`)
- Restored T082 frontend: `usePlayback.ts`, `PlayerPage.tsx`, `PlayerControls.tsx`, `useFeaturedMedia.ts`
- Split xtream provider into `buildXtreamMovieUrl` / `buildXtreamEpisodeUrl`
- Added ffmpeg/ffprobe startup checks + `apps/api/nixpacks.toml`
- Restored 7 test files; all pass (486 web + 837 API tests green)
- T083 resilience additions (ErrorBoundary, ProtectedRoute spinner, PreviewContext matchMedia guard, AuthContext boot-flow) preserved intact

**BLOCKING: awaiting manual smoke test** — login flow + authenticated home UI rendering + playback cannot be automated. Requires a human to verify against a live environment before this branch is merged.

---

## Review

---

# PR Review — T084: Repair blank-UI merge regression

## Résumé

T084 vise à corriger la régression introduite par T083 : suppression de 465 artefacts générés commis dans le repo, restauration du pipeline HLS/playback T082, préservation des améliorations de résilience T083, et réparation du flow login.

L'implémentation est structurellement solide sur les axes principaux. Cependant, des tests de régression auth explicitement requis par le ticket sont absents, et le smoke test manuel (marqué BLOCKING par le ticket) n'a pas été effectué.

---

## Vérifications effectuées

- Analyse des fichiers clés modifiés/ajoutés : `AuthContext.tsx`, `ProtectedRoute.tsx`, `App.tsx`, `ErrorBoundary.tsx`, `PreviewContext.tsx`, `usePlayback.ts`, `PlayerPage.tsx`, `PlayerControls.tsx`, `playback.ts` (routes), `playback-resolver.ts`, `hls-session-store.ts`, `playback-compat.ts`, `playback-session-store.ts`, `probe-cache.ts`, `media-prober.ts`, `nixpacks.toml`, `api-contracts/playback.ts`
- Vérification que les artefacts générés ont bien été supprimés du suivi git
- Vérification de la couverture de tests ajoutés
- Comparaison des comportements AuthContext entre T082, T083 et T084

---

## Points validés

### Suppression des artefacts générés (cause racine)
- ✅ Les 465 fichiers `.js`/`.d.ts`/`dist/` commis par T083 sont supprimés du suivi git
- ✅ Le `.gitignore` couvrait déjà ces patterns — aucune modification supplémentaire nécessaire
- ✅ Seul `apps/web/src/vite-env.d.ts` reste suivi, explicitement re-inclus par `!apps/web/src/vite-env.d.ts`

### Pipeline T082 restauré
- ✅ `hls-session-store.ts` : gestion TTL des sessions ffmpeg, nettoyage périodique, protection path traversal (`SEGMENT_RE`)
- ✅ `media-prober.ts` : wrapper ffprobe complet
- ✅ `playback-compat.ts` : `classifyDelivery()` + `buildFfmpegArgs()` pour les 4 modes
- ✅ `playback-session-store.ts` : store in-memory avec TTL 2h
- ✅ `probe-cache.ts` : cache 24h des résultats ffprobe
- ✅ `playback.ts` : 5 routes gateway (resolve, DIRECT stream + Range, segment proxy URI, HLS playlist, HLS segments)
- ✅ `playback-resolver.ts` : pipeline probe→classify→session→gateway, fallback extension si probe échoue
- ✅ Split xtream : `buildXtreamMovieUrl` / `buildXtreamEpisodeUrl` (épisodes via `/series/` path)

### Contrats API mis à jour
- ✅ `PlaybackSessionResponse` : `gatewayUrl`, `deliveryMode`, `probeResult`, `containerExtension` à la place de `streamUrl`
- ✅ `DeliveryMode` type exporté du bon package
- ✅ `usePlayback` et `PlayerPage` cohérents avec le nouveau contrat

### Résilience T083 préservée
- ✅ `ErrorBoundary` wrappant l'app entière dans `App.tsx`
- ✅ `ProtectedRoute` : spinner visible pendant `isLoading` (plus de `return null` silencieux)
- ✅ `PreviewContext` : guard `typeof window.matchMedia === 'function'` correct (init + useEffect)
- ✅ `AuthContext` : boot flow préservé

### Déploiement Railway
- ✅ `apps/api/nixpacks.toml` : `nixPkgs = ["ffmpeg"]`
- ✅ Checks au démarrage : ffmpeg, ffprobe, répertoire tmp accessible

### Tests ajoutés
- ✅ `playback-compat.test.ts` : classifyDelivery + buildFfmpegArgs (127 lignes, bon coverage)
- ✅ `probe-cache.test.ts` : TTL, hit/miss
- ✅ `hls-session-store.test.ts` : cycle de vie session, SEGMENT_RE, path traversal
- ✅ `playback-gateway.test.ts` : 415 lignes, couvre DIRECT MP4, Range, HLS playlist, segments, erreurs upstream
- ✅ `playback-resolver.test.ts` : mis à jour avec le nouveau contrat (`gatewayUrl`, modes de livraison)
- ✅ `ErrorBoundary.test.tsx` : catch render error + fallback personnalisé
- ✅ `useFeaturedMedia.test.ts` : logique de sélection film/série
- ✅ `e2e/tests/playback.spec.ts` : résolution + streaming gateway + vérification absence credentials
- ✅ `test/setup.ts` : stub `window.matchMedia` (fix jsdom)
- ✅ `test/handlers.ts` : split `/api/search` / `/api/search/remote`

---

## Problèmes détectés

### 🔴 P1 — Tests de régression auth absents (requis explicitement par le ticket)

Le ticket liste comme requirements :

> - login success transitions through `AuthContext` + `ProtectedRoute` into the authenticated app
> - login failure is visible and recoverable
> - refresh with valid auth remains authenticated

**Aucun de ces tests n'est présent.** Il n'existe pas de fichiers `AuthContext.test.tsx`, `ProtectedRoute.test.tsx` ou `LoginPage.test.tsx` dans le diff. La couverture existante ne les inclut pas.

Le code lui-même semble fonctionnel (LoginPage distingue 401 de l'erreur générique, ProtectedRoute affiche un spinner pendant le boot, AuthContext démarre avec `isLoading: true`), mais les tests de régression spécifiquement demandés sont absents.

**Correction requise :** Ajouter a minima :
1. Test `AuthContext` : `getMe` succeed → `isAuthenticated=true` ; `getMe` reject → `isAuthenticated=false, isLoading=false`
2. Test `ProtectedRoute` : affiche spinner pendant loading ; redirige vers `/login` si non authentifié ; rend children si authentifié
3. Test `LoginPage` : succès navigue vers `/` ; 401 affiche "Invalid username or password" ; erreur réseau affiche "Login failed"

---

### 🟡 P2 — `AuthContext` : toute erreur `getMe()` est traitée comme "non authentifié"

```ts
.catch(() => {
  setIsAuthenticated(false)
  setUsername(null)
})
```

Le ticket demande explicitement : *"an API/bootstrap error is not misinterpreted as permanent unauthenticated state"*.

En pratique, puisque `isAuthenticated` initialise à `false`, le comportement est identique à T082 (même une erreur 500 ou un timeout réseau aboutissait à la même redirection vers `/login`). Ce n'est pas une régression T084. Mais la distinction entre "non-connecté" et "API indisponible" n'est implémentée ni en T082 ni ici. **Ce point n'est pas bloquant** mais devrait idéalement faire l'objet d'un ticket distinct si la DX doit s'améliorer.

---

### 🟡 P3 — `process.exit(1)` si ffmpeg absent au démarrage

Le check de démarrage tue le processus si ffmpeg/ffprobe n'est pas installé. Cela rompt le démarrage en environnement de développement local sans ffmpeg. Le ticket est explicitement axé sur Railway, où nixpacks installe ffmpeg. Acceptable comme choix de design pour Railway, mais risque de friction pour les contributeurs locaux.

---

### 🟡 P4 — Test "aucun artefact compilé dans git" absent

Le ticket demande : *"no generated source-tree compiler artifacts are produced/tracked by normal tests/build"* comme test de régression. Aucun test automatisé ne vérifie cette propriété (e.g., un test qui exécute `tsc` et vérifie que `git status` ne produit pas de nouveaux `.js` dans `src/`).

---

### ℹ️ P5 — Smoke test manuel non effectué (bloquant selon le ticket)

L'implementation-output l'indique explicitement : *"BLOCKING: awaiting manual smoke test"*. Le ticket l'exige avant de considérer le ticket complet. Cette validation ne peut pas être effectuée automatiquement et doit être faite manuellement en environnement production-like.

---

## Risques éventuels

- **Régression déploiement si CI n'a pas ffmpeg** : le startup check forcera l'arrêt en CI si ffmpeg n'est pas disponible dans le runner. À vérifier contre la configuration CI existante.
- **HEAD probe sur erreur vidéo** (`checkGatewayStatus()` dans `PlayerPage`) : ajoute une requête supplémentaire asynchrone sur chaque erreur vidéo. Comportement correct mais latence d'affichage légèrement augmentée en cas d'erreur.

---

## Décision

REQUEST_CHANGES

---

## Actions demandées

1. **[Bloquant]** Ajouter les 3 tests auth requis par le ticket :
   - `AuthContext` : boot flow (success / error / loading transitions)
   - `ProtectedRoute` : spinner loading / redirect unauthenticated / render authenticated
   - `LoginPage` : submit success → navigate ; 401 → message erreur identifiants ; erreur générique → message erreur générique

2. **[Recommandé]** Ajouter un test ou un script CI qui vérifie qu'après `tsc --build`, aucun `.js`/`.d.ts` n'apparaît dans `git status` sur `apps/web/src/`.

3. **[Non-bloquant, à documenter]** Clarifier dans un commentaire `index.ts` ou un `README` que ffmpeg est requis au runtime (pas seulement en Railway), de sorte que les développeurs locaux sachent l'installer.

4. **[Post-merge obligatoire]** Effectuer le smoke test manuel complet (login + refresh + Home/Films/Series + bouton Regarder + erreur playback isolée) sur un environnement production-like avant de marquer le ticket complet.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T084/reviews/implementation-review.md
- generated at: 2026-08-16T19:29:57Z

---

---

# PR Review — T084: Repair blank-UI merge regression

## Résumé

T084 vise à corriger la régression introduite par T083 : suppression de 465 artefacts générés commis dans le repo, restauration du pipeline HLS/playback T082, préservation des améliorations de résilience T083, et réparation du flow login.

L'implémentation est structurellement solide sur les axes principaux. Cependant, des tests de régression auth explicitement requis par le ticket sont absents, et le smoke test manuel (marqué BLOCKING par le ticket) n'a pas été effectué.

---

## Vérifications effectuées

- Analyse des fichiers clés modifiés/ajoutés : `AuthContext.tsx`, `ProtectedRoute.tsx`, `App.tsx`, `ErrorBoundary.tsx`, `PreviewContext.tsx`, `usePlayback.ts`, `PlayerPage.tsx`, `PlayerControls.tsx`, `playback.ts` (routes), `playback-resolver.ts`, `hls-session-store.ts`, `playback-compat.ts`, `playback-session-store.ts`, `probe-cache.ts`, `media-prober.ts`, `nixpacks.toml`, `api-contracts/playback.ts`
- Vérification que les artefacts générés ont bien été supprimés du suivi git
- Vérification de la couverture de tests ajoutés
- Comparaison des comportements AuthContext entre T082, T083 et T084

---

## Points validés

### Suppression des artefacts générés (cause racine)
- ✅ Les 465 fichiers `.js`/`.d.ts`/`dist/` commis par T083 sont supprimés du suivi git
- ✅ Le `.gitignore` couvrait déjà ces patterns — aucune modification supplémentaire nécessaire
- ✅ Seul `apps/web/src/vite-env.d.ts` reste suivi, explicitement re-inclus par `!apps/web/src/vite-env.d.ts`

### Pipeline T082 restauré
- ✅ `hls-session-store.ts` : gestion TTL des sessions ffmpeg, nettoyage périodique, protection path traversal (`SEGMENT_RE`)
- ✅ `media-prober.ts` : wrapper ffprobe complet
- ✅ `playback-compat.ts` : `classifyDelivery()` + `buildFfmpegArgs()` pour les 4 modes
- ✅ `playback-session-store.ts` : store in-memory avec TTL 2h
- ✅ `probe-cache.ts` : cache 24h des résultats ffprobe
- ✅ `playback.ts` : 5 routes gateway (resolve, DIRECT stream + Range, segment proxy URI, HLS playlist, HLS segments)
- ✅ `playback-resolver.ts` : pipeline probe→classify→session→gateway, fallback extension si probe échoue
- ✅ Split xtream : `buildXtreamMovieUrl` / `buildXtreamEpisodeUrl` (épisodes via `/series/` path)

### Contrats API mis à jour
- ✅ `PlaybackSessionResponse` : `gatewayUrl`, `deliveryMode`, `probeResult`, `containerExtension` à la place de `streamUrl`
- ✅ `DeliveryMode` type exporté du bon package
- ✅ `usePlayback` et `PlayerPage` cohérents avec le nouveau contrat

### Résilience T083 préservée
- ✅ `ErrorBoundary` wrappant l'app entière dans `App.tsx`
- ✅ `ProtectedRoute` : spinner visible pendant `isLoading` (plus de `return null` silencieux)
- ✅ `PreviewContext` : guard `typeof window.matchMedia === 'function'` correct (init + useEffect)
- ✅ `AuthContext` : boot flow préservé

### Déploiement Railway
- ✅ `apps/api/nixpacks.toml` : `nixPkgs = ["ffmpeg"]`
- ✅ Checks au démarrage : ffmpeg, ffprobe, répertoire tmp accessible

### Tests ajoutés
- ✅ `playback-compat.test.ts` : classifyDelivery + buildFfmpegArgs (127 lignes, bon coverage)
- ✅ `probe-cache.test.ts` : TTL, hit/miss
- ✅ `hls-session-store.test.ts` : cycle de vie session, SEGMENT_RE, path traversal
- ✅ `playback-gateway.test.ts` : 415 lignes, couvre DIRECT MP4, Range, HLS playlist, segments, erreurs upstream
- ✅ `playback-resolver.test.ts` : mis à jour avec le nouveau contrat (`gatewayUrl`, modes de livraison)
- ✅ `ErrorBoundary.test.tsx` : catch render error + fallback personnalisé
- ✅ `useFeaturedMedia.test.ts` : logique de sélection film/série
- ✅ `e2e/tests/playback.spec.ts` : résolution + streaming gateway + vérification absence credentials
- ✅ `test/setup.ts` : stub `window.matchMedia` (fix jsdom)
- ✅ `test/handlers.ts` : split `/api/search` / `/api/search/remote`

---

## Problèmes détectés

### 🔴 P1 — Tests de régression auth absents (requis explicitement par le ticket)

Le ticket liste comme requirements :

> - login success transitions through `AuthContext` + `ProtectedRoute` into the authenticated app
> - login failure is visible and recoverable
> - refresh with valid auth remains authenticated

**Aucun de ces tests n'est présent.** Il n'existe pas de fichiers `AuthContext.test.tsx`, `ProtectedRoute.test.tsx` ou `LoginPage.test.tsx` dans le diff. La couverture existante ne les inclut pas.

Le code lui-même semble fonctionnel (LoginPage distingue 401 de l'erreur générique, ProtectedRoute affiche un spinner pendant le boot, AuthContext démarre avec `isLoading: true`), mais les tests de régression spécifiquement demandés sont absents.

**Correction requise :** Ajouter a minima :
1. Test `AuthContext` : `getMe` succeed → `isAuthenticated=true` ; `getMe` reject → `isAuthenticated=false, isLoading=false`
2. Test `ProtectedRoute` : affiche spinner pendant loading ; redirige vers `/login` si non authentifié ; rend children si authentifié
3. Test `LoginPage` : succès navigue vers `/` ; 401 affiche "Invalid username or password" ; erreur réseau affiche "Login failed"

---

### 🟡 P2 — `AuthContext` : toute erreur `getMe()` est traitée comme "non authentifié"

```ts
.catch(() => {
  setIsAuthenticated(false)
  setUsername(null)
})
```

Le ticket demande explicitement : *"an API/bootstrap error is not misinterpreted as permanent unauthenticated state"*.

En pratique, puisque `isAuthenticated` initialise à `false`, le comportement est identique à T082 (même une erreur 500 ou un timeout réseau aboutissait à la même redirection vers `/login`). Ce n'est pas une régression T084. Mais la distinction entre "non-connecté" et "API indisponible" n'est implémentée ni en T082 ni ici. **Ce point n'est pas bloquant** mais devrait idéalement faire l'objet d'un ticket distinct si la DX doit s'améliorer.

---

### 🟡 P3 — `process.exit(1)` si ffmpeg absent au démarrage

Le check de démarrage tue le processus si ffmpeg/ffprobe n'est pas installé. Cela rompt le démarrage en environnement de développement local sans ffmpeg. Le ticket est explicitement axé sur Railway, où nixpacks installe ffmpeg. Acceptable comme choix de design pour Railway, mais risque de friction pour les contributeurs locaux.

---

### 🟡 P4 — Test "aucun artefact compilé dans git" absent

Le ticket demande : *"no generated source-tree compiler artifacts are produced/tracked by normal tests/build"* comme test de régression. Aucun test automatisé ne vérifie cette propriété (e.g., un test qui exécute `tsc` et vérifie que `git status` ne produit pas de nouveaux `.js` dans `src/`).

---

### ℹ️ P5 — Smoke test manuel non effectué (bloquant selon le ticket)

L'implementation-output l'indique explicitement : *"BLOCKING: awaiting manual smoke test"*. Le ticket l'exige avant de considérer le ticket complet. Cette validation ne peut pas être effectuée automatiquement et doit être faite manuellement en environnement production-like.

---

## Risques éventuels

- **Régression déploiement si CI n'a pas ffmpeg** : le startup check forcera l'arrêt en CI si ffmpeg n'est pas disponible dans le runner. À vérifier contre la configuration CI existante.
- **HEAD probe sur erreur vidéo** (`checkGatewayStatus()` dans `PlayerPage`) : ajoute une requête supplémentaire asynchrone sur chaque erreur vidéo. Comportement correct mais latence d'affichage légèrement augmentée en cas d'erreur.

---

## Décision

REQUEST_CHANGES

---

## Actions demandées

1. **[Bloquant]** Ajouter les 3 tests auth requis par le ticket :
   - `AuthContext` : boot flow (success / error / loading transitions)
   - `ProtectedRoute` : spinner loading / redirect unauthenticated / render authenticated
   - `LoginPage` : submit success → navigate ; 401 → message erreur identifiants ; erreur générique → message erreur générique

2. **[Recommandé]** Ajouter un test ou un script CI qui vérifie qu'après `tsc --build`, aucun `.js`/`.d.ts` n'apparaît dans `git status` sur `apps/web/src/`.

3. **[Non-bloquant, à documenter]** Clarifier dans un commentaire `index.ts` ou un `README` que ffmpeg est requis au runtime (pas seulement en Railway), de sorte que les développeurs locaux sachent l'installer.

4. **[Post-merge obligatoire]** Effectuer le smoke test manuel complet (login + refresh + Home/Films/Series + bouton Regarder + erreur playback isolée) sur un environnement production-like avant de marquer le ticket complet.

IMPLEMENTATION_FIX_REQUIRED