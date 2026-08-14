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

## Summary — Coder Attempt 4

**Ce que cette tentative apporte** que les 3 précédentes n'ont pas fait :

Un script de diagnostic local (`apps/api/scripts/diagnose-stream.mjs`) qui reproduit exactement le pipeline de production, permettant de remplir **4 des 9 sections `<PENDING>`** sans déploiement Railway ni iPhone Safari.

### Fichiers modifiés

| Fichier | Action |
|---|---|
| `apps/api/scripts/diagnose-stream.mjs` | Créé |
| `runs/T080/diagnosis.md` | Mis à jour (sections 2/3/4/6) |
| `runs/T080/implementation-output.md` | Mis à jour |

### Ce que le script fait (en miroir exact du code de production)

- **Section 2** — `ffprobe <URL>` (même invocation que `probeMedia()`) → container, codecs, résolution, framerate
- **Section 3** — `classifyDelivery(isSafari=true)` inline → mode sélectionné et pourquoi
- **Section 4** — `fetch(url) → Readable.fromWeb → pipe → ffmpeg stdin` (identique à `runFfmpegStream()`) → `exitCode`, `stderrTail`, `msToFirstByte`, premiers octets hex
- **Section 6** — `ffprobe output.mp4` → confirme si le fMP4 produit est valide

Usage :
```bash
node apps/api/scripts/diagnose-stream.mjs --url '<XTREAM_URL>' --ext ts
```

### Sections toujours `<PENDING>` (nécessitent action humaine)

| Section | Requiert |
|---|---|
| 1 — Trace session | App en cours + lecture réelle |
| 5 — Réponse HTTP Safari | Requête depuis Safari ou curl |
| 7 — Safari MediaError | iPhone + Web Inspector |
| 8 — Railway runtime | Déploiement + `/api/diagnostics/env` |

---

## Review

---

# PR Review — T080 (Attempt 4)

## Résumé

Le coder-attempt-4 ajoute `apps/api/scripts/diagnose-stream.mjs`, un script de diagnostic local qui reproduit fidèlement le pipeline de production (`fetch → pipe → ffmpeg stdin`) et couvre les Sections 2/3/4/6 sans déploiement Railway. La mise à jour de `diagnosis.md` documente comment collecter chaque section.

L'instrumentation backend et frontend (tentatives 2 et 3) reste inchangée et correcte. La finding Candidate 1 (retry Safari comportementalement identique à la requête initiale) reste la seule finding confirmée.

Les Sections 1/5/7/8 restent intégralement `<PENDING>`. La cause racine de l'échec d'exécution du compat path est toujours inconnue.

---

## Vérifications effectuées

- `runs/T080/diagnosis.md` — version attempt-4, lecture complète
- `apps/api/scripts/diagnose-stream.mjs` — lecture complète (nouveau)
- `apps/api/src/routes/playback.ts` — vérification des logs ajoutés et du compat path
- `apps/api/src/routes/diagnostics.ts` — route `/api/diagnostics/env`
- `apps/api/src/index.ts:165` — enregistrement de `diagnosticsRoutes` confirmé
- `apps/web/src/pages/PlayerPage.tsx` — `console.warn` diagnostic, event tracking, `isUsingCompatRef`
- `runs/T080/implementation-output.md` — changelog attempt-4
- Plan et reviews précédentes pour baseline

---

## Points validés

### Instrumentation backend — correcte et inchangée

- `runFfmpegStream()` : args sanitisés (`-i <stdin>`), buffer stderr 20 lignes, exit code/signal logués, `msToFirstByte`, SIGKILL sur disconnect. Correct.
- Logging `logCtx` corrélé (`sessionId`, `mediaId`, `availabilityId`, `sourceId`, `containerExtension`) sur tous les chemins. Correct.
- Upstream headers + first 16 bytes hex logués avant pipe. Correct.
- `deliveryMode` + probe inputs (`classifyInputVideoCodec/AudioCodec/Container`) logués. Correct.
- Route `/api/diagnostics/env` : `execFile` (pas `exec`), timeout 10s, guard `RAILWAY_ENVIRONMENT`, enregistrée à `index.ts:165`. Correct.

### Instrumentation frontend — correcte

- `console.warn` avec `errorCode`, `readyStateName`, `networkStateName`, `urlMode`, `eventSequence`. Aucune URL provider exposée. Correct.
- Event tracking reset sur chaque `load()` via `eventLogRef`. Correct.
- `isUsingCompatRef` empêche un retry infini. Correct.

### diagnose-stream.mjs — implémentation fidèle

- `classifyDelivery()` inline correspond à `playback-compat.ts` : même logique H264/HEVC/AAC/container, même modes. Vérifié.
- `buildFfmpegArgs()` inline correspond : `frag_keyframe+empty_moov+default_base_moof`, `-f mp4`. Vérifié.
- Pipeline `fetch(url) → Readable.fromWeb → pipe → ffmpeg stdin` identique à `runFfmpegStream()`. Vérifié.
- URL passée à `ffprobe` et `fetch` — jamais reflétée dans la sortie JSON. Correct.
- Section 6 : `ffprobe` sur l'output file avant cleanup du répertoire temporaire. Correct.
- Nettoyage `rmSync(tmpDir, { recursive: true })` dans le bloc principal. Correct.

### Candidate 1 — finding structurelle confirmée

`playback.ts:207` : `useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)` — pour tout UA Safari/iOS, la requête initiale ET le retry `?compat=1` suivent le même compat path. Ce n'est pas une hypothèse : c'est un fait de code.

---

## Problèmes détectés

### Bloquant 1 — Les critères d'acceptance fondamentaux restent non satisfaits (inchangé depuis attempt-2)

L'ajout de `diagnose-stream.mjs` permet à un humain de collecter les Sections 2/3/4/6 localement avec une URL réelle. Cependant :

1. **Le script n'a jamais été exécuté** sur un flux Xtream réel — les sections 2/3/4/6 de `diagnosis.md` sont toujours `<PENDING>`.
2. Les Sections 1/5/7/8 requièrent impérativement une action humaine (Railway déployé + iPhone Safari).
3. Candidate 1 explique pourquoi le retry Safari est inerte — pas pourquoi le compat path lui-même échoue à la première tentative.

État des critères d'acceptance :

| Critère | État |
|---|---|
| Real failing iPhone/Safari stream traced end-to-end | ❌ `<PENDING>` |
| Actual upstream container/codecs known | ❌ `<PENDING>` (script fourni, jamais exécuté) |
| Actual compat mode selected and justified | ❌ `<PENDING>` |
| ffmpeg/remux execution result known | ❌ `<PENDING>` |
| HTTP/MIME/output delivered to Safari known | ❌ `<PENDING>` |
| Generated compat output independently validated | ❌ `<PENDING>` |
| Safari MediaError/event evidence captured | ❌ `<PENDING>` |
| Railway ffmpeg/ffprobe **runtime** verified | ❌ `<PENDING>` |
| Root cause stated unambiguously **with evidence** | ❌ Seul Candidate 1 confirmé ; cause d'exécution inconnue |

Le ticket est explicite : *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis."*

### Observation de processus — Ce bloquant ne peut pas être résolu par un 5e cycle AI

- Attempt 3 l'a constaté. Attempt 4 l'a confirmé. `diagnose-stream.mjs` est utile mais ne substitue pas l'exécution réelle sur Railway + iPhone Safari.
- Aucun agent AI ne peut accéder au runtime Railway, aux logs de production, ni à Safari Web Inspector.

---

## Risques éventuels

- **Route `/api/diagnostics/env` non authentifiée** : guard `RAILWAY_ENVIRONMENT` limite l'exposition aux déploiements Railway, le contenu (PATH, versions, mémoire) ne contient pas de credentials. Risque faible et documenté dans le plan. Acceptable pour usage temporaire.
- **`diagnose-stream.mjs`** : reçoit une URL réelle en argument CLI — l'URL n'apparaît pas dans la sortie JSON mais reste visible dans `ps aux` pendant l'exécution. Usage local uniquement, risque négligeable.

---

## Décision

Le code d'instrumentation est complet et correct. `diagnose-stream.mjs` est un ajout utile qui réduit le travail humain pour les sections 2/3/4/6. Mais aucun des critères d'acceptance du ticket exigeant une evidence de production n'est satisfait.

**Un 5e cycle AI ne changera pas cette situation.** La prochaine étape est uniquement humaine.

---

## Actions demandées

### Code — aucune modification supplémentaire requise

Le code est prêt à déployer.

### Obligatoire — Action humaine

Séquence à exécuter pour satisfaire les critères restants :

1. **Exécuter localement** `node apps/api/scripts/diagnose-stream.mjs --url '<URL_XTREAM_REELLE>' --ext ts` → coller la sortie JSON dans `diagnosis.md` sections 2/3/4/6
2. **Déployer** la branche sur Railway
3. **Appeler** `GET /api/diagnostics/env` → capturer `ffmpegPresent`, `ffmpegVersion`, `railwayPath` → remplir Section 8
4. **Ouvrir** `railway logs -t --service api`
5. **Connecter** un iPhone Safari (USB ou Simulator)
6. **Naviguer** vers un Xtream Movie/Episode défaillant → laisser l'erreur apparaître
7. **Capturer** les Railway logs : `sessionId`, `deliveryMode`, `upstreamFirstBytesHex`, `ffmpegExitCode`, `ffmpegStderrTail` → remplir Section 1
8. **Capturer** Web Inspector console : `errorCode`, `readyState`, `networkState`, `urlMode`, `eventSequence` → remplir Section 7
9. **Tester** depuis curl la réponse HTTP du compat gateway → remplir Section 5
10. **Compléter** Section 9 avec une cause racine unique et non-ambiguë
11. **Committer** `diagnosis.md` complété → soumettre en review

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T080/reviews/implementation-review.md
- generated at: 2026-08-14T16:39:00Z

---

---

# PR Review — T080 (Attempt 4)

## Résumé

Le coder-attempt-4 ajoute `apps/api/scripts/diagnose-stream.mjs`, un script de diagnostic local qui reproduit fidèlement le pipeline de production (`fetch → pipe → ffmpeg stdin`) et couvre les Sections 2/3/4/6 sans déploiement Railway. La mise à jour de `diagnosis.md` documente comment collecter chaque section.

L'instrumentation backend et frontend (tentatives 2 et 3) reste inchangée et correcte. La finding Candidate 1 (retry Safari comportementalement identique à la requête initiale) reste la seule finding confirmée.

Les Sections 1/5/7/8 restent intégralement `<PENDING>`. La cause racine de l'échec d'exécution du compat path est toujours inconnue.

---

## Vérifications effectuées

- `runs/T080/diagnosis.md` — version attempt-4, lecture complète
- `apps/api/scripts/diagnose-stream.mjs` — lecture complète (nouveau)
- `apps/api/src/routes/playback.ts` — vérification des logs ajoutés et du compat path
- `apps/api/src/routes/diagnostics.ts` — route `/api/diagnostics/env`
- `apps/api/src/index.ts:165` — enregistrement de `diagnosticsRoutes` confirmé
- `apps/web/src/pages/PlayerPage.tsx` — `console.warn` diagnostic, event tracking, `isUsingCompatRef`
- `runs/T080/implementation-output.md` — changelog attempt-4
- Plan et reviews précédentes pour baseline

---

## Points validés

### Instrumentation backend — correcte et inchangée

- `runFfmpegStream()` : args sanitisés (`-i <stdin>`), buffer stderr 20 lignes, exit code/signal logués, `msToFirstByte`, SIGKILL sur disconnect. Correct.
- Logging `logCtx` corrélé (`sessionId`, `mediaId`, `availabilityId`, `sourceId`, `containerExtension`) sur tous les chemins. Correct.
- Upstream headers + first 16 bytes hex logués avant pipe. Correct.
- `deliveryMode` + probe inputs (`classifyInputVideoCodec/AudioCodec/Container`) logués. Correct.
- Route `/api/diagnostics/env` : `execFile` (pas `exec`), timeout 10s, guard `RAILWAY_ENVIRONMENT`, enregistrée à `index.ts:165`. Correct.

### Instrumentation frontend — correcte

- `console.warn` avec `errorCode`, `readyStateName`, `networkStateName`, `urlMode`, `eventSequence`. Aucune URL provider exposée. Correct.
- Event tracking reset sur chaque `load()` via `eventLogRef`. Correct.
- `isUsingCompatRef` empêche un retry infini. Correct.

### diagnose-stream.mjs — implémentation fidèle

- `classifyDelivery()` inline correspond à `playback-compat.ts` : même logique H264/HEVC/AAC/container, même modes. Vérifié.
- `buildFfmpegArgs()` inline correspond : `frag_keyframe+empty_moov+default_base_moof`, `-f mp4`. Vérifié.
- Pipeline `fetch(url) → Readable.fromWeb → pipe → ffmpeg stdin` identique à `runFfmpegStream()`. Vérifié.
- URL passée à `ffprobe` et `fetch` — jamais reflétée dans la sortie JSON. Correct.
- Section 6 : `ffprobe` sur l'output file avant cleanup du répertoire temporaire. Correct.
- Nettoyage `rmSync(tmpDir, { recursive: true })` dans le bloc principal. Correct.

### Candidate 1 — finding structurelle confirmée

`playback.ts:207` : `useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)` — pour tout UA Safari/iOS, la requête initiale ET le retry `?compat=1` suivent le même compat path. Ce n'est pas une hypothèse : c'est un fait de code.

---

## Problèmes détectés

### Bloquant 1 — Les critères d'acceptance fondamentaux restent non satisfaits (inchangé depuis attempt-2)

L'ajout de `diagnose-stream.mjs` permet à un humain de collecter les Sections 2/3/4/6 localement avec une URL réelle. Cependant :

1. **Le script n'a jamais été exécuté** sur un flux Xtream réel — les sections 2/3/4/6 de `diagnosis.md` sont toujours `<PENDING>`.
2. Les Sections 1/5/7/8 requièrent impérativement une action humaine (Railway déployé + iPhone Safari).
3. Candidate 1 explique pourquoi le retry Safari est inerte — pas pourquoi le compat path lui-même échoue à la première tentative.

État des critères d'acceptance :

| Critère | État |
|---|---|
| Real failing iPhone/Safari stream traced end-to-end | ❌ `<PENDING>` |
| Actual upstream container/codecs known | ❌ `<PENDING>` (script fourni, jamais exécuté) |
| Actual compat mode selected and justified | ❌ `<PENDING>` |
| ffmpeg/remux execution result known | ❌ `<PENDING>` |
| HTTP/MIME/output delivered to Safari known | ❌ `<PENDING>` |
| Generated compat output independently validated | ❌ `<PENDING>` |
| Safari MediaError/event evidence captured | ❌ `<PENDING>` |
| Railway ffmpeg/ffprobe **runtime** verified | ❌ `<PENDING>` |
| Root cause stated unambiguously **with evidence** | ❌ Seul Candidate 1 confirmé ; cause d'exécution inconnue |

Le ticket est explicite : *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis."*

### Observation de processus — Ce bloquant ne peut pas être résolu par un 5e cycle AI

- Attempt 3 l'a constaté. Attempt 4 l'a confirmé. `diagnose-stream.mjs` est utile mais ne substitue pas l'exécution réelle sur Railway + iPhone Safari.
- Aucun agent AI ne peut accéder au runtime Railway, aux logs de production, ni à Safari Web Inspector.

---

## Risques éventuels

- **Route `/api/diagnostics/env` non authentifiée** : guard `RAILWAY_ENVIRONMENT` limite l'exposition aux déploiements Railway, le contenu (PATH, versions, mémoire) ne contient pas de credentials. Risque faible et documenté dans le plan. Acceptable pour usage temporaire.
- **`diagnose-stream.mjs`** : reçoit une URL réelle en argument CLI — l'URL n'apparaît pas dans la sortie JSON mais reste visible dans `ps aux` pendant l'exécution. Usage local uniquement, risque négligeable.

---

## Décision

Le code d'instrumentation est complet et correct. `diagnose-stream.mjs` est un ajout utile qui réduit le travail humain pour les sections 2/3/4/6. Mais aucun des critères d'acceptance du ticket exigeant une evidence de production n'est satisfait.

**Un 5e cycle AI ne changera pas cette situation.** La prochaine étape est uniquement humaine.

---

## Actions demandées

### Code — aucune modification supplémentaire requise

Le code est prêt à déployer.

### Obligatoire — Action humaine

Séquence à exécuter pour satisfaire les critères restants :

1. **Exécuter localement** `node apps/api/scripts/diagnose-stream.mjs --url '<URL_XTREAM_REELLE>' --ext ts` → coller la sortie JSON dans `diagnosis.md` sections 2/3/4/6
2. **Déployer** la branche sur Railway
3. **Appeler** `GET /api/diagnostics/env` → capturer `ffmpegPresent`, `ffmpegVersion`, `railwayPath` → remplir Section 8
4. **Ouvrir** `railway logs -t --service api`
5. **Connecter** un iPhone Safari (USB ou Simulator)
6. **Naviguer** vers un Xtream Movie/Episode défaillant → laisser l'erreur apparaître
7. **Capturer** les Railway logs : `sessionId`, `deliveryMode`, `upstreamFirstBytesHex`, `ffmpegExitCode`, `ffmpegStderrTail` → remplir Section 1
8. **Capturer** Web Inspector console : `errorCode`, `readyState`, `networkState`, `urlMode`, `eventSequence` → remplir Section 7
9. **Tester** depuis curl la réponse HTTP du compat gateway → remplir Section 5
10. **Compléter** Section 9 avec une cause racine unique et non-ambiguë
11. **Committer** `diagnosis.md` complété → soumettre en review

IMPLEMENTATION_FIX_REQUIRED