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


# T080 — Diagnose production Safari/iOS playback failure after compatibility fallback

**Source**: GitHub Issue #170

## Description

## Context
Playback now reaches the player and the Safari/iOS compatibility fallback from T079/#167 executes, but production iPhone Safari still ends with `Impossible de lire ce contenu sur ce navigateur`.

The previous ticket's test report explicitly could not verify the real iPhone/Safari production criterion. This ticket is DIAGNOSTIC ONLY: identify the exact failure in the real production playback path before changing strategy again.

## Goal
Produce a conclusive root-cause diagnosis for one or more real failing imported Xtream Movie/Episode streams on production-like Railway + iPhone Safari.

Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis that directly determines the correction ticket.

## Required investigation

### 1. Trace one real playback session end-to-end
For a failing real availability, correlate:
- canonical media id/type;
- availability id;
- source id;
- provider item id;
- stored container extension;
- playback session id;
- original gateway URL;
- compatibility gateway path/mode;
- browser/user agent category.

Never log provider credentials/full secret-bearing Xtream URLs.

### 2. Probe actual upstream media
Run/record ffprobe-equivalent metadata for the real selected upstream stream:
- actual container;
- video codec;
- codec profile/level/pixel format;
- resolution/frame rate;
- audio codec/channels/sample rate;
- duration if VOD;
- whether the upstream response is actually valid media rather than HTML/error/redirect.

### 3. Record compatibility decision
For the failing stream, log which mode `classifyDelivery()` chooses and WHY:
- DIRECT;
- proxy/pass-through;
- REMUX;
- TRANSCODE_AUDIO;
- TRANSCODE_VIDEO;
- other implemented mode.

Include the sanitized probe inputs that produced that decision.

### 4. Inspect ffmpeg execution
When fallback uses ffmpeg/remux/transcode, capture sanitized diagnostics:
- exact mode;
- sanitized ffmpeg arguments (input secret removed/masked);
- process spawn success/failure;
- exit code/signal;
- relevant stderr tail;
- time until first output bytes;
- whether ffmpeg remains alive until client disconnect;
- whether Railway kills it for resource/runtime reasons.

### 5. Validate HTTP response delivered to Safari
For BOTH original gateway and compat gateway, inspect:
- HTTP status;
- Content-Type;
- Content-Length / chunked transfer behavior;
- Accept-Ranges / Content-Range behavior;
- caching headers where relevant;
- first bytes/signature of output;
- whether response terminates prematurely;
- whether redirects occur;
- whether browser receives fMP4/MP4/HLS/TS/etc. matching the advertised MIME type.

### 6. Validate generated media outside the app
Take the compat output for the same real stream and determine whether it is independently playable/valid using suitable media inspection/player tooling. This distinguishes frontend integration failure from invalid gateway output.

### 7. Safari-specific evidence
Capture browser media error details available from the video element:
- MediaError code;
- readyState/networkState;
- source URL mode (normal vs compat);
- relevant events (`loadedmetadata`, `canplay`, `stalled`, `error`, etc.).

Add temporary safe diagnostic telemetry if necessary, but do not expose secrets.

### 8. Check deployment prerequisites
Verify in the ACTUAL Railway API deployment:
- ffmpeg exists;
- ffprobe exists;
- expected versions;
- nixpacks/build config is actually used;
- CPU/RAM/disk/temp-dir constraints;
- no missing executable/path/config mismatch between tests and production.

### 9. Test more than one representative stream
At minimum diagnose:
- the currently failing real iPhone case;
- one known/simple MP4 H.264/AAC availability if present;
- one availability requiring compat/remux if present.

This will reveal whether failure is universal or format-specific.

## Deliverable
Commit a diagnostic report under the ticket run artifacts containing:
- exact failing stage;
- observed upstream media metadata;
- selected compatibility mode;
- observed gateway/ffmpeg behavior;
- Safari-visible error;
- root cause;
- recommended correction with concrete code/components involved.

Do NOT implement a broad speculative fix in this ticket unless a tiny instrumentation fix is required to obtain evidence.

## Acceptance criteria
- [ ] A real production-like failing iPhone/Safari stream has been traced end-to-end.
- [ ] Actual upstream container/codecs are known.
- [ ] Actual compatibility mode selected is known and justified.
- [ ] ffmpeg/remux/transcode execution result is known when used.
- [ ] Actual HTTP/MIME/output delivered by compat gateway is known.
- [ ] It is known whether generated compat output is itself valid media.
- [ ] Safari media error/event evidence is captured.
- [ ] Railway ffmpeg/ffprobe deployment is verified, not assumed.
- [ ] Root cause is stated unambiguously with evidence.
- [ ] A concrete correction plan exists for the follow-up issue.
- [ ] Ticket is NOT marked complete merely because automated compatibility unit tests pass.

## Related
Follow-up to #167 / T079. The correction should be implemented in a separate ticket based on this diagnosis.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

## Summary — Coder Attempt 3

The remaining review blocker (`IMPLEMENTATION_FIX_REQUIRED`) was operational, not a code issue. Rather than produce another no-op cycle, I extracted static evidence from the codebase to meaningfully advance the diagnosis.

**What changed** (`runs/T080/diagnosis.md`):

- **Executive Summary** rewritten to lead with confirmed findings vs. pending ones
- **Section 8** updated: `apps/api/nixpacks.toml:2` confirms `nixPkgs = ["ffmpeg"]` — ffmpeg IS configured in the Railway build (ffprobe bundled). Runtime PATH still needs `/api/diagnostics/env` to rule out edge cases.
- **Section 9 — Candidate 1** promoted from HIGH hypothesis to **CONFIRMED STRUCTURAL DEFECT**: `playback.ts:207` proves `useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)`. For Safari UA, both `gatewayUrl` and `compatUrl` (`?compat=1`) execute the **identical** compat code path. The "fallback" is inert — no production trace needed to confirm this.
- **Section 9 — Candidate 2** demoted from MEDIUM to **LOW**: nixpacks.toml largely rules out ffmpeg absence.

---

**What still requires human action** (unchanged from attempt-2):

The production trace collecting Sections 1–8 evidence (`sessionId`, `ffmpegExitCode`, `ffmpegStderrTail`, Safari `errorCode`, etc.) requires:
1. Deploy this branch to Railway
2. Call `GET /api/diagnostics/env` to confirm ffmpeg runtime presence
3. Play a failing Xtream stream on iPhone Safari with Railway log stream + Web Inspector open
4. Fill the `<PENDING>` fields in `diagnosis.md` Sections 1–8

The instrumentation to collect that evidence is fully in place.

---

## Review

Now I have everything I need. Let me write the review.

---

# PR Review — T080 (Attempt 3)

## Résumé

Le coder-attempt-3 n'a pas ajouté d'evidence de production mais a extrait une finding valide par analyse statique : **Candidate 1 est confirmé comme défaut structurel du code** — `playback.ts:207` prouve que Safari UA déclenche `useCompat=true` sur la PREMIÈRE requête, rendant le retry `?compat=1` comportementalement identique. C'est une finding réelle.

Cependant, ce défaut structurel explique pourquoi le retry ne remédie pas à l'échec, pas pourquoi le compat path lui-même échoue. L'erreur "Impossible de lire ce contenu sur ce navigateur" sur iPhone Safari a une cause d'exécution qui reste inconnue. Les Sections 1–8 de `diagnosis.md` restent intégralement `<PENDING>`.

---

## Vérifications effectuées

- Lecture complète de `runs/T080/diagnosis.md` (version attempt-3)
- Lecture complète de `apps/api/src/routes/playback.ts` (lignes 61–140, 185–260, 390–470)
- Lecture complète de `apps/api/src/routes/diagnostics.ts`
- Lecture complète de `apps/api/scripts/check-env.mjs`
- Lecture des zones modifiées de `apps/web/src/pages/PlayerPage.tsx`
- Vérification de l'enregistrement du route diagnostics dans `apps/api/src/index.ts`
- Lecture de `runs/T080/implementation-output.md` (attempt-3 changelog)
- Lecture du plan et des deux reviews précédentes

---

## Points validés (inchangés depuis attempt-2)

**Code de qualité correcte — aucune régression**

- `runFfmpegStream()` : spawn log sanitisé (`-i <stdin>`), buffer stderr 20 lignes, exit code/signal, `msToFirstByte`, SIGKILL sur disconnect. Correct.
- `diagnostics.ts` : `execFile` (pas `exec`), timeout 10s, guard `RAILWAY_ENVIRONMENT`, enregistré hors scope protégé avec guard applicatif. Correct.
- `PlayerPage.tsx` error handler : `console.warn` avec `errorCode`, `readyState`, `networkState`, `urlMode`, `eventSequence`. Aucune exposition d'URL provider. Correct.
- `check-env.mjs` : script autonome, sortie JSON, error exit propre. Correct.
- Logging `logCtx` corrélé sur tous les chemins. Correct.

**Candidate 1 — finding statique valide**

`playback.ts:207` : `const useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)`

Pour tout UA Safari/iOS :
1. Requête initiale → `isSafariOrIOS()` = true → `useCompat = true` → compat path complet
2. Fallback frontend → retry avec `?compat=1` → `request.query.compat === '1'` = true → **compat path identique**

Ce n'est pas une hypothèse architecturale — c'est un fait de code directement lisible. Candidate 1 est confirmécomme défaut structurel.

**Section 8 — nixpacks partiellement vérifié**

`apps/api/nixpacks.toml:2` confirme `nixPkgs = ["ffmpeg"]`. Candidate 2 (ffmpeg absent) correctement rabaissé à LOW.

---

## Problèmes détectés

### Bloquant 1 — La cause racine de l'échec d'exécution reste inconnue (inchangé depuis attempt-2)

Candidate 1 explique pourquoi le retry Safari est inerte. Il n'explique **pas** pourquoi le compat path lui-même échoue à la première tentative. L'erreur "Impossible de lire ce contenu sur ce navigateur" a une cause d'exécution concrète — une ou plusieurs parmi :

- ffmpeg absent du PATH Railway à runtime (Candidate 2, LOW mais non éliminé)
- ffmpeg échoue / produit un fMP4 invalide pour le flux réel (Candidate 3)
- `Content-Type` incohérent avec le container produit (Candidate 3)
- Probe toujours en échec → routing par extension incorrect (Candidate 4)

Sans evidence d'exécution, le ticket correctif ne saura pas quelle stratégie appliquer. Corriger uniquement le retry (Candidate 1) sans corriger la cause d'exécution n'eliminera pas l'erreur utilisateur.

Les critères d'acceptance suivants restent **non satisfaits** :

| Critère | État |
|---|---|
| Real failing iPhone/Safari stream traced end-to-end | ❌ `<PENDING>` |
| Actual upstream container/codecs known | ❌ `<PENDING>` |
| Actual compat mode selected and justified | ❌ `<PENDING>` |
| ffmpeg/remux execution result known | ❌ `<PENDING>` |
| HTTP/MIME/output delivered to Safari known | ❌ `<PENDING>` |
| Generated compat output independently validated | ❌ `<PENDING>` |
| Safari MediaError/event evidence captured | ❌ `<PENDING>` |
| Railway ffmpeg/ffprobe **runtime** verified | ❌ `<PENDING>` (build config ≠ runtime PATH) |
| Root cause stated unambiguously **with evidence** | ❌ Candidate 1 confirmé, cause d'exécution inconnue |

Le ticket est explicite : *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis."*

### Observation de processus — Ce bloquant ne peut pas être résolu par un agent AI

Trois cycles coder ont produit la même situation. Le coder-attempt-3 l'a lui-même reconnu explicitement. Un quatrième cycle AI ne pourra pas collecter l'evidence de production. Ce bloquant est **opérationnel**, pas un défaut de code.

---

## Décision

L'instrumentation est complète et correcte. Candidate 1 est un finding valide. Mais les critères d'acceptance fondamentaux du ticket (evidence de production, cause racine d'exécution confirmée) ne sont pas satisfaits, pour des raisons qui ne sont pas résolubles par un agent AI seul.

**Un cycle coder supplémentaire ne changera pas cette situation.**

---

## Actions demandées

### Obligatoire — Action humaine, non délégable à un agent AI

La seule séquence qui permet de satisfaire les critères restants :

1. **Déployer** la branche `ticket/T080-diagnose-production-safari-ios-playback-failure-af` sur Railway
2. **Appeler** `GET /api/diagnostics/env` → capturer `ffmpegPresent`, `ffmpegVersion`, `ffprobePresent`, `railwayPath`
3. **Ouvrir** `railway logs -t --service api` en parallèle
4. **Connecter** un iPhone Safari à Safari Web Inspector (USB ou Simulator)
5. **Naviguer** vers un Xtream Movie/Episode défaillant → laisser l'erreur apparaître
6. **Capturer** Railway logs : `sessionId`, `deliveryMode`, `upstreamFirstBytesHex`, `ffmpegExitCode`, `ffmpegStderrTail`
7. **Capturer** Web Inspector console : `errorCode`, `readyState`, `networkState`, `urlMode`, `eventSequence`
8. **Remplir** les Sections 1–8 de `runs/T080/diagnosis.md`
9. **Compléter** la Section 9 avec une cause racine unique non-ambiguë : ex. *"ffmpeg sur Railway retourne exit code 1 avec stderr 'Invalid data found when processing input' — le flux TS upstream est invalide"* ou *"classifyDelivery retourne DIRECT pour un flux TS que Safari ne peut pas décoder"*
10. **Committer** `diagnosis.md` complété → soumettre en review

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T080/reviews/implementation-review.md
- generated at: 2026-08-14T16:29:50Z

---

Now I have everything I need. Let me write the review.

---

# PR Review — T080 (Attempt 3)

## Résumé

Le coder-attempt-3 n'a pas ajouté d'evidence de production mais a extrait une finding valide par analyse statique : **Candidate 1 est confirmé comme défaut structurel du code** — `playback.ts:207` prouve que Safari UA déclenche `useCompat=true` sur la PREMIÈRE requête, rendant le retry `?compat=1` comportementalement identique. C'est une finding réelle.

Cependant, ce défaut structurel explique pourquoi le retry ne remédie pas à l'échec, pas pourquoi le compat path lui-même échoue. L'erreur "Impossible de lire ce contenu sur ce navigateur" sur iPhone Safari a une cause d'exécution qui reste inconnue. Les Sections 1–8 de `diagnosis.md` restent intégralement `<PENDING>`.

---

## Vérifications effectuées

- Lecture complète de `runs/T080/diagnosis.md` (version attempt-3)
- Lecture complète de `apps/api/src/routes/playback.ts` (lignes 61–140, 185–260, 390–470)
- Lecture complète de `apps/api/src/routes/diagnostics.ts`
- Lecture complète de `apps/api/scripts/check-env.mjs`
- Lecture des zones modifiées de `apps/web/src/pages/PlayerPage.tsx`
- Vérification de l'enregistrement du route diagnostics dans `apps/api/src/index.ts`
- Lecture de `runs/T080/implementation-output.md` (attempt-3 changelog)
- Lecture du plan et des deux reviews précédentes

---

## Points validés (inchangés depuis attempt-2)

**Code de qualité correcte — aucune régression**

- `runFfmpegStream()` : spawn log sanitisé (`-i <stdin>`), buffer stderr 20 lignes, exit code/signal, `msToFirstByte`, SIGKILL sur disconnect. Correct.
- `diagnostics.ts` : `execFile` (pas `exec`), timeout 10s, guard `RAILWAY_ENVIRONMENT`, enregistré hors scope protégé avec guard applicatif. Correct.
- `PlayerPage.tsx` error handler : `console.warn` avec `errorCode`, `readyState`, `networkState`, `urlMode`, `eventSequence`. Aucune exposition d'URL provider. Correct.
- `check-env.mjs` : script autonome, sortie JSON, error exit propre. Correct.
- Logging `logCtx` corrélé sur tous les chemins. Correct.

**Candidate 1 — finding statique valide**

`playback.ts:207` : `const useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)`

Pour tout UA Safari/iOS :
1. Requête initiale → `isSafariOrIOS()` = true → `useCompat = true` → compat path complet
2. Fallback frontend → retry avec `?compat=1` → `request.query.compat === '1'` = true → **compat path identique**

Ce n'est pas une hypothèse architecturale — c'est un fait de code directement lisible. Candidate 1 est confirmécomme défaut structurel.

**Section 8 — nixpacks partiellement vérifié**

`apps/api/nixpacks.toml:2` confirme `nixPkgs = ["ffmpeg"]`. Candidate 2 (ffmpeg absent) correctement rabaissé à LOW.

---

## Problèmes détectés

### Bloquant 1 — La cause racine de l'échec d'exécution reste inconnue (inchangé depuis attempt-2)

Candidate 1 explique pourquoi le retry Safari est inerte. Il n'explique **pas** pourquoi le compat path lui-même échoue à la première tentative. L'erreur "Impossible de lire ce contenu sur ce navigateur" a une cause d'exécution concrète — une ou plusieurs parmi :

- ffmpeg absent du PATH Railway à runtime (Candidate 2, LOW mais non éliminé)
- ffmpeg échoue / produit un fMP4 invalide pour le flux réel (Candidate 3)
- `Content-Type` incohérent avec le container produit (Candidate 3)
- Probe toujours en échec → routing par extension incorrect (Candidate 4)

Sans evidence d'exécution, le ticket correctif ne saura pas quelle stratégie appliquer. Corriger uniquement le retry (Candidate 1) sans corriger la cause d'exécution n'eliminera pas l'erreur utilisateur.

Les critères d'acceptance suivants restent **non satisfaits** :

| Critère | État |
|---|---|
| Real failing iPhone/Safari stream traced end-to-end | ❌ `<PENDING>` |
| Actual upstream container/codecs known | ❌ `<PENDING>` |
| Actual compat mode selected and justified | ❌ `<PENDING>` |
| ffmpeg/remux execution result known | ❌ `<PENDING>` |
| HTTP/MIME/output delivered to Safari known | ❌ `<PENDING>` |
| Generated compat output independently validated | ❌ `<PENDING>` |
| Safari MediaError/event evidence captured | ❌ `<PENDING>` |
| Railway ffmpeg/ffprobe **runtime** verified | ❌ `<PENDING>` (build config ≠ runtime PATH) |
| Root cause stated unambiguously **with evidence** | ❌ Candidate 1 confirmé, cause d'exécution inconnue |

Le ticket est explicite : *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis."*

### Observation de processus — Ce bloquant ne peut pas être résolu par un agent AI

Trois cycles coder ont produit la même situation. Le coder-attempt-3 l'a lui-même reconnu explicitement. Un quatrième cycle AI ne pourra pas collecter l'evidence de production. Ce bloquant est **opérationnel**, pas un défaut de code.

---

## Décision

L'instrumentation est complète et correcte. Candidate 1 est un finding valide. Mais les critères d'acceptance fondamentaux du ticket (evidence de production, cause racine d'exécution confirmée) ne sont pas satisfaits, pour des raisons qui ne sont pas résolubles par un agent AI seul.

**Un cycle coder supplémentaire ne changera pas cette situation.**

---

## Actions demandées

### Obligatoire — Action humaine, non délégable à un agent AI

La seule séquence qui permet de satisfaire les critères restants :

1. **Déployer** la branche `ticket/T080-diagnose-production-safari-ios-playback-failure-af` sur Railway
2. **Appeler** `GET /api/diagnostics/env` → capturer `ffmpegPresent`, `ffmpegVersion`, `ffprobePresent`, `railwayPath`
3. **Ouvrir** `railway logs -t --service api` en parallèle
4. **Connecter** un iPhone Safari à Safari Web Inspector (USB ou Simulator)
5. **Naviguer** vers un Xtream Movie/Episode défaillant → laisser l'erreur apparaître
6. **Capturer** Railway logs : `sessionId`, `deliveryMode`, `upstreamFirstBytesHex`, `ffmpegExitCode`, `ffmpegStderrTail`
7. **Capturer** Web Inspector console : `errorCode`, `readyState`, `networkState`, `urlMode`, `eventSequence`
8. **Remplir** les Sections 1–8 de `runs/T080/diagnosis.md`
9. **Compléter** la Section 9 avec une cause racine unique non-ambiguë : ex. *"ffmpeg sur Railway retourne exit code 1 avec stderr 'Invalid data found when processing input' — le flux TS upstream est invalide"* ou *"classifyDelivery retourne DIRECT pour un flux TS que Safari ne peut pas décoder"*
10. **Committer** `diagnosis.md` complété → soumettre en review

IMPLEMENTATION_FIX_REQUIRED