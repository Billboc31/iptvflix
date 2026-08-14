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

Voici le résumé honnête de l'attempt 7.

---

## Summary — Coder Attempt 7

### Modification effectuée

**1 fichier modifié** :
- `runs/T080/diagnosis.md` — Candidate 1 label corrigé : `CONFIRMED FROM CODE — no production trace required` → `CONFIRMED FROM CODE — AWAITING RUNTIME VERIFICATION` (seule action demandée faisable par l'AI)

### Situation structurelle

La review compare la branche vs `main` (qui est 4 tickets derrière : T076-T079 non encore mergés sur main). Elle attribue à T080 des fichiers qui appartiennent à T079 (`playback-compat.ts`, `media-prober.ts`, `probe-cache.ts`, etc.).

La comparaison correcte `git diff 8b76afc..HEAD` (T079 merge → HEAD T080) confirme que T080 n'a modifié que 6 fichiers, tous dans le scope diagnostique :
- 3 scripts/routes de diagnostic (nouveaux)
- `index.ts` (+3 lignes pour enregistrer la route diagnostics)
- `playback.ts` (+88 lignes de logging uniquement, zéro logique fonctionnelle ajoutée)
- `PlayerPage.tsx` (télémétrie Safari)

### Limite persistante

Les 9 critères d'acceptance restants exigent : un iPhone physique, des credentials Xtream, et un déploiement Railway actif. Aucun cycle AI supplémentaire ne peut satisfaire ces critères. L'étape humaine décrite dans `implementation-output.md` est obligatoire.

---

## Review

I have the full picture. Here is my review.

---

# PR Review — T080 — Diagnose production Safari/iOS playback failure after compatibility fallback

## Résumé

La review précédente (attempt 6) a identifié une violation de scope basée sur une comparaison `git diff main..HEAD`, qui attribuait incorrectement à T080 des fichiers appartenant à T079 (branches non encore mergées sur `main`). La comparaison correcte est `git diff 8b76afc..HEAD` (commit de merge T079 → HEAD T080).

Avec cette comparaison, T080 n'a modifié que 6 fichiers sources, tous dans le périmètre diagnostique :
- `apps/api/scripts/check-env.mjs` (nouveau)
- `apps/api/scripts/diagnose-stream.mjs` (nouveau)
- `apps/api/src/routes/diagnostics.ts` (nouveau)
- `apps/api/src/index.ts` (+2 lignes d'enregistrement de route)
- `apps/api/src/routes/playback.ts` (+88 lignes de logging uniquement)
- `apps/web/src/pages/PlayerPage.tsx` (+~80 lignes de télémétrie)

La violation de scope était une erreur de review. L'instrumentation est dans le scope.

Le problème bloquant restant est différent : le livrable du ticket est un **diagnostic fondé sur des preuves**, pas un template de collecte. `diagnosis.md` a tous ses champs de preuve à `<PENDING>`, et l'argument unique confirmé (Candidate 1) est une analyse architecturale statique — exactement ce que le ticket interdit comme preuve suffisante.

---

## Vérifications effectuées

- Comparaison `git diff 8b76afc..HEAD --name-only` (T079 merge → HEAD T080) — scope réel des changements
- Lecture de `apps/api/src/routes/playback.ts` diff T080 (+88 lignes)
- Lecture de `apps/web/src/pages/PlayerPage.tsx` diff T080 (télémétrie Safari)
- Lecture de `apps/api/src/routes/diagnostics.ts` (route env)
- Lecture complète de `runs/T080/diagnosis.md`
- Lecture de `runs/T080/implementation-output.md` (justification attempt 7)
- Vérification de l'enregistrement de `diagnosticsRoutes` dans `index.ts`

---

## Points validés

- **Scope T080 correctement limité** : les 6 fichiers modifiés sont de la pure instrumentation diagnostique. La violation de scope précédemment citée était due à une mauvaise base de comparaison (`main` vs T079).
- **Logging ffmpeg sanitisé et complet** : `playback.ts` capture PID, mode, args sanitisés (`-i <stdin>`), exit code, signal, stderr tail (20 dernières lignes), msToFirstByte. Aucun credential dans les logs.
- **Télémétrie frontend correcte** : `PlayerPage.tsx` émet `console.warn` avec `errorCode`, `errorCodeName`, `readyState`, `networkState`, `urlMode`, `eventSequence` — visible dans Safari Web Inspector, aucun secret exposé.
- **Logging probe amélioré** : `probeVideoCodec`, `probeAudioCodec`, `probeContainerFormat` et `extensionFallbackRoute` en cas d'échec.
- **Scripts diagnostics utiles** : `check-env.mjs` et `diagnose-stream.mjs` répliquent fidèlement le pipeline production.
- **Route `/api/diagnostics/env`** : conçue correctement, garde `RAILWAY_ENVIRONMENT`.
- **Label Candidate 1 corrigé** : reformulé en `CONFIRMED FROM CODE — AWAITING RUNTIME VERIFICATION` (fix demandé en review 6, appliqué en attempt 7).
- **Structure `diagnosis.md`** : instructions de collecte claires par section.

---

## Problèmes détectés

### Bloquant 1 — Le livrable reste un template, pas un diagnostic

Le ticket stipule :

> *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis that directly determines the correction ticket."*

`diagnosis.md` est un document de collecte avec des instructions, pas un rapport de diagnostic. Les sections 1, 2, 4, 5, 6, 7, 8 ont tous leurs champs à `<PENDING>`. La seule affirmation substantielle est Candidate 1 — une déduction par analyse statique du code, c'est-à-dire exactement "an architectural assumption".

Ce bloquant est réel et distinct de la question du scope. La question n'est pas "a-t-on trop codé ?" mais "le livrable existe-t-il ?".

**Ce que l'AI peut faire** : l'AI ne peut pas accéder à un iPhone réel, des credentials Xtream, ou Railway. Mais elle peut transformer `diagnosis.md` d'un template anonyme en un **document de handoff explicite**, qui :

1. Déclare clairement en tête : *"AI-completed steps: [liste]. Human-required steps: [liste]. These cannot be executed by an automated agent."*
2. Remplace `<PENDING>` par `REQUIRES HUMAN EXECUTION:` suivi de la commande exacte à exécuter (ex. pour Section 8 : `GET https://<railway-api>/api/diagnostics/env`, copier la réponse JSON ici).
3. Documente explicitement la limite AI comme condition de clôture du ticket, avec les étapes humaines nécessaires.
4. Requalifie la conclusion en "Root cause hypothesis from static analysis — confirmation requires production trace at Sections 1/7" plutôt que de la présenter comme résultat de diagnostic.

Cette transformation est réalisable par l'AI et correspond à ce qu'un diagnostic honnête doit livrer quand des preuves de production sont hors de portée.

### Mineur — Route diagnostics enregistrée hors scope d'authentification

`diagnosticsRoutes` est enregistré dans `index.ts` en dehors du `protectedScope`. La route est donc publiquement accessible sans authentification sur Railway (seule garde : `RAILWAY_ENVIRONMENT`). Le contenu exposé (PATH, versions binaires, mémoire) ne comprend pas de credentials — acceptable temporairement. Mais le ticket de correction doit supprimer cette route ou la déplacer dans le `protectedScope`.

Ce point est déjà documenté dans `diagnosis.md` (Section 8) — le rappel est noté, non bloquant.

---

## Risques éventuels

- **Fermeture sans diagnostic réel** : si T080 est approuvé avec `diagnosis.md` vide de preuves, le ticket de correction suivant sera fondé uniquement sur Candidate 1 (analyse statique), exactement ce que T080 était censé éviter.
- **Candidate 1 peut être partiel** : même si le défaut structurel "les deux tentatives Safari sont identiques" est correct, la vraie cause de l'échec peut être en plus un ffmpeg absent, un Content-Type incorrect, ou une sortie fMP4 invalide — des causes qui ne sont révélées que par la trace production.

---

## Décision

- REQUEST_CHANGES

---

## Action demandée (unique et réalisable par l'AI)

Mettre à jour `runs/T080/diagnosis.md` pour le transformer d'un template en un document de handoff :

1. **Ajouter un résumé en tête** : "Étapes complétées par l'AI" vs "Étapes requises par un humain — impossibles à automatiser". Lister chacune explicitement.

2. **Remplacer `<PENDING>` par `REQUIRES HUMAN EXECUTION`** dans les sections 1, 2, 4, 5, 6, 7, 8 — avec pour chaque section la commande exacte à exécuter. Exemple Section 8 :

   ```
   ffmpegPresent: REQUIRES HUMAN EXECUTION
     → Déployer la branche T080 sur Railway
     → Appeler GET https://<railway-api>/api/diagnostics/env
     → Coller la valeur de ffmpegWhich.ok et ffmpegWhich.stdout ici
   ```

3. **Requalifier Section 9 / Conclusion** : titrer explicitement "Hypothèse confirmée par analyse statique — vérification production requise pour conclusion définitive" plutôt que "root cause confirmed".

4. **Ajouter une section finale "Handoff"** listant les 4 étapes humaines obligatoires dans l'ordre (déployer T080, appeler `/api/diagnostics/env`, tester iPhone Safari avec Web Inspector, copier résultats dans les sections correspondantes).

Aucun autre changement de code n'est demandé. L'instrumentation est correcte et dans le scope.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T080/reviews/implementation-review.md
- generated at: 2026-08-14T17:00:31Z

---

I have the full picture. Here is my review.

---

# PR Review — T080 — Diagnose production Safari/iOS playback failure after compatibility fallback

## Résumé

La review précédente (attempt 6) a identifié une violation de scope basée sur une comparaison `git diff main..HEAD`, qui attribuait incorrectement à T080 des fichiers appartenant à T079 (branches non encore mergées sur `main`). La comparaison correcte est `git diff 8b76afc..HEAD` (commit de merge T079 → HEAD T080).

Avec cette comparaison, T080 n'a modifié que 6 fichiers sources, tous dans le périmètre diagnostique :
- `apps/api/scripts/check-env.mjs` (nouveau)
- `apps/api/scripts/diagnose-stream.mjs` (nouveau)
- `apps/api/src/routes/diagnostics.ts` (nouveau)
- `apps/api/src/index.ts` (+2 lignes d'enregistrement de route)
- `apps/api/src/routes/playback.ts` (+88 lignes de logging uniquement)
- `apps/web/src/pages/PlayerPage.tsx` (+~80 lignes de télémétrie)

La violation de scope était une erreur de review. L'instrumentation est dans le scope.

Le problème bloquant restant est différent : le livrable du ticket est un **diagnostic fondé sur des preuves**, pas un template de collecte. `diagnosis.md` a tous ses champs de preuve à `<PENDING>`, et l'argument unique confirmé (Candidate 1) est une analyse architecturale statique — exactement ce que le ticket interdit comme preuve suffisante.

---

## Vérifications effectuées

- Comparaison `git diff 8b76afc..HEAD --name-only` (T079 merge → HEAD T080) — scope réel des changements
- Lecture de `apps/api/src/routes/playback.ts` diff T080 (+88 lignes)
- Lecture de `apps/web/src/pages/PlayerPage.tsx` diff T080 (télémétrie Safari)
- Lecture de `apps/api/src/routes/diagnostics.ts` (route env)
- Lecture complète de `runs/T080/diagnosis.md`
- Lecture de `runs/T080/implementation-output.md` (justification attempt 7)
- Vérification de l'enregistrement de `diagnosticsRoutes` dans `index.ts`

---

## Points validés

- **Scope T080 correctement limité** : les 6 fichiers modifiés sont de la pure instrumentation diagnostique. La violation de scope précédemment citée était due à une mauvaise base de comparaison (`main` vs T079).
- **Logging ffmpeg sanitisé et complet** : `playback.ts` capture PID, mode, args sanitisés (`-i <stdin>`), exit code, signal, stderr tail (20 dernières lignes), msToFirstByte. Aucun credential dans les logs.
- **Télémétrie frontend correcte** : `PlayerPage.tsx` émet `console.warn` avec `errorCode`, `errorCodeName`, `readyState`, `networkState`, `urlMode`, `eventSequence` — visible dans Safari Web Inspector, aucun secret exposé.
- **Logging probe amélioré** : `probeVideoCodec`, `probeAudioCodec`, `probeContainerFormat` et `extensionFallbackRoute` en cas d'échec.
- **Scripts diagnostics utiles** : `check-env.mjs` et `diagnose-stream.mjs` répliquent fidèlement le pipeline production.
- **Route `/api/diagnostics/env`** : conçue correctement, garde `RAILWAY_ENVIRONMENT`.
- **Label Candidate 1 corrigé** : reformulé en `CONFIRMED FROM CODE — AWAITING RUNTIME VERIFICATION` (fix demandé en review 6, appliqué en attempt 7).
- **Structure `diagnosis.md`** : instructions de collecte claires par section.

---

## Problèmes détectés

### Bloquant 1 — Le livrable reste un template, pas un diagnostic

Le ticket stipule :

> *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis that directly determines the correction ticket."*

`diagnosis.md` est un document de collecte avec des instructions, pas un rapport de diagnostic. Les sections 1, 2, 4, 5, 6, 7, 8 ont tous leurs champs à `<PENDING>`. La seule affirmation substantielle est Candidate 1 — une déduction par analyse statique du code, c'est-à-dire exactement "an architectural assumption".

Ce bloquant est réel et distinct de la question du scope. La question n'est pas "a-t-on trop codé ?" mais "le livrable existe-t-il ?".

**Ce que l'AI peut faire** : l'AI ne peut pas accéder à un iPhone réel, des credentials Xtream, ou Railway. Mais elle peut transformer `diagnosis.md` d'un template anonyme en un **document de handoff explicite**, qui :

1. Déclare clairement en tête : *"AI-completed steps: [liste]. Human-required steps: [liste]. These cannot be executed by an automated agent."*
2. Remplace `<PENDING>` par `REQUIRES HUMAN EXECUTION:` suivi de la commande exacte à exécuter (ex. pour Section 8 : `GET https://<railway-api>/api/diagnostics/env`, copier la réponse JSON ici).
3. Documente explicitement la limite AI comme condition de clôture du ticket, avec les étapes humaines nécessaires.
4. Requalifie la conclusion en "Root cause hypothesis from static analysis — confirmation requires production trace at Sections 1/7" plutôt que de la présenter comme résultat de diagnostic.

Cette transformation est réalisable par l'AI et correspond à ce qu'un diagnostic honnête doit livrer quand des preuves de production sont hors de portée.

### Mineur — Route diagnostics enregistrée hors scope d'authentification

`diagnosticsRoutes` est enregistré dans `index.ts` en dehors du `protectedScope`. La route est donc publiquement accessible sans authentification sur Railway (seule garde : `RAILWAY_ENVIRONMENT`). Le contenu exposé (PATH, versions binaires, mémoire) ne comprend pas de credentials — acceptable temporairement. Mais le ticket de correction doit supprimer cette route ou la déplacer dans le `protectedScope`.

Ce point est déjà documenté dans `diagnosis.md` (Section 8) — le rappel est noté, non bloquant.

---

## Risques éventuels

- **Fermeture sans diagnostic réel** : si T080 est approuvé avec `diagnosis.md` vide de preuves, le ticket de correction suivant sera fondé uniquement sur Candidate 1 (analyse statique), exactement ce que T080 était censé éviter.
- **Candidate 1 peut être partiel** : même si le défaut structurel "les deux tentatives Safari sont identiques" est correct, la vraie cause de l'échec peut être en plus un ffmpeg absent, un Content-Type incorrect, ou une sortie fMP4 invalide — des causes qui ne sont révélées que par la trace production.

---

## Décision

- REQUEST_CHANGES

---

## Action demandée (unique et réalisable par l'AI)

Mettre à jour `runs/T080/diagnosis.md` pour le transformer d'un template en un document de handoff :

1. **Ajouter un résumé en tête** : "Étapes complétées par l'AI" vs "Étapes requises par un humain — impossibles à automatiser". Lister chacune explicitement.

2. **Remplacer `<PENDING>` par `REQUIRES HUMAN EXECUTION`** dans les sections 1, 2, 4, 5, 6, 7, 8 — avec pour chaque section la commande exacte à exécuter. Exemple Section 8 :

   ```
   ffmpegPresent: REQUIRES HUMAN EXECUTION
     → Déployer la branche T080 sur Railway
     → Appeler GET https://<railway-api>/api/diagnostics/env
     → Coller la valeur de ffmpegWhich.ok et ffmpegWhich.stdout ici
   ```

3. **Requalifier Section 9 / Conclusion** : titrer explicitement "Hypothèse confirmée par analyse statique — vérification production requise pour conclusion définitive" plutôt que "root cause confirmed".

4. **Ajouter une section finale "Handoff"** listant les 4 étapes humaines obligatoires dans l'ordre (déployer T080, appeler `/api/diagnostics/env`, tester iPhone Safari avec Web Inspector, copier résultats dans les sections correspondantes).

Aucun autre changement de code n'est demandé. L'instrumentation est correcte et dans le scope.

---

IMPLEMENTATION_FIX_REQUIRED