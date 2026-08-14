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

Double import corrigé. Maintenant le résumé honnête de ce coder attempt 6.

---

## Summary — Coder Attempt 6

### Modification effectuée

**1 fichier modifié** :
- `apps/api/scripts/diagnose-stream.mjs` — fusion des deux imports `node:child_process` dupliqués (lignes 17 et 22) en un seul `import { spawn, execFile } from 'node:child_process'`

### Limite structurelle non résolue (6e cycle)

Ce cycle AI ne peut pas débloquer les critères d'acceptance bloquants. Ils exigent des ressources que l'agent n'a pas :

| Section | Ce qu'il faut | Pourquoi bloqué pour l'AI |
|---|---|---|
| 1/5/7 | Session iPhone Safari + Web Inspector en direct | Nécessite un iPhone physique et une session Railway live |
| 2/3/4/6 | Exécuter `diagnose-stream.mjs` avec une vraie URL Xtream | Nécessite les credentials provider (non présents dans le repo) |
| 8 | `GET /api/diagnostics/env` sur Railway réel | Nécessite un déploiement Railway actif |

### Séquence humaine requise (identique à l'attempt 5)

```bash
# 1. Local — sections 2/3/4/6 (récupérer une URL Xtream depuis l'app ou la DB)
node apps/api/scripts/diagnose-stream.mjs --url '<URL_XTREAM_REELLE>' --ext ts \
  | tee /tmp/diag-result.json

# 2. Railway — section 8
curl https://<votre-api>.railway.app/api/diagnostics/env

# 3. Railway logs live pendant test iPhone — section 1
railway logs -t --service api

# 4. iPhone Safari avec Web Inspector connecté — sections 5/7
# Naviguer vers un film Xtream défaillant, capturer console.warn '[iptvflix:player]'
```

Coller les résultats dans `runs/T080/diagnosis.md` (les sections PENDING) et committer. Sans cette étape, aucun cycle AI supplémentaire ne peut débloquer ce ticket.

---

## Review

# PR Review — T080 — Diagnose production Safari/iOS playback failure after compatibility fallback

## Résumé

T080 est un ticket **diagnostic uniquement**. Le livrable attendu est un rapport de root-cause basé sur des preuves issues d'une vraie session de lecture iPhone/Safari sur Railway, PAS sur une analyse statique du code. L'implémentation livre une infrastructure d'instrumentation complète (routes, services, tests) et un rapport `diagnosis.md` dont les 8 sections de preuves sont intégralement `<PENDING>`. Les critères d'acceptation requis par le ticket ne sont pas satisfaits.

---

## Vérifications effectuées

- Lecture du ticket T080 complet (description, critères d'acceptation)
- Lecture de `runs/T080/diagnosis.md`
- Review de tous les fichiers modifiés sur la branche vs `main` : `playback.ts`, `playback-compat.ts`, `media-prober.ts`, `probe-cache.ts`, `playback-session-store.ts`, `playback-resolver.ts`, `diagnostics.ts`, `PlayerPage.tsx`, `diagnose-stream.mjs`, `nixpacks.toml`
- Vérification de la couverture de test produite
- Comparaison du contenu du rapport `diagnosis.md` avec les critères d'acceptation

---

## Points validés

- **Instrumentation backend cohérente** : `sessionId`, `availabilityId`, `sourceId`, `deliveryMode`, headers upstream/réponse, signature hex, PID/exitCode/stderr ffmpeg — tous loggés et sanitisés (pas de credentials dans les logs).
- **Télémétrie frontend correcte** : `console.warn` dans `PlayerPage.tsx` capture `errorCode`, `readyState`, `networkState`, `urlMode`, `eventSequence` sans exposer de secrets.
- **Script local `diagnose-stream.mjs`** : réplique fidèlement le pipeline production et permettrait de collecter les sections 2/3/4/6 sans Railway.
- **Route `/api/diagnostics/env`** : conception adéquate pour vérifier la présence de ffmpeg/ffprobe au runtime Railway.
- **Candidate 1 logiquement cohérent** : `useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)` implique effectivement que les deux tentatives Safari suivent le même code path. C'est un défaut structurel réel.
- **Structure du rapport** : bien organisée, avec instructions de collecte claires pour chaque section.

---

## Problèmes détectés

### Bloquant 1 — Livrable principal absent : zéro preuve de production

Le ticket stipule explicitement :

> *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis that directly determines the correction ticket."*

Le rapport `runs/T080/diagnosis.md` a **tous les champs de preuve à `<PENDING>`** :

```
Section 1  — sessionId, deliveryMode, ffmpegExitCode, Safari errorCode : <PENDING>
Section 2  — containerFormat, videoCodec, audioCodec, duration :         <PENDING>
Section 3  — classifyDelivery résultat réel :                            <PENDING>
Section 4  — ffmpegPid, exitCode, stderrTail, msToFirstByte :           <PENDING>
Section 5  — responseContentType, httpStatus, Transfer-Encoding :        <PENDING>
Section 6  — outputIsValidMedia, outputContainer :                       <PENDING>
Section 7  — errorCode (URL normale/compat), eventSequence Safari :      <PENDING>
Section 8  — ffmpegPresent, ffmpegVersion (runtime Railway) :            <PENDING>
```

La seule affirmation marquée `CONFIRMED` est le Candidate 1 — une déduction issue du code, présentée comme preuve alors que le ticket interdit explicitement cette approche. Aucune des 11 cases d'acceptation listées dans le ticket n'est cochée.

### Bloquant 2 — Violation de scope : implémentation fonctionnelle dans un ticket purement diagnostique

Le ticket autorise uniquement *"a tiny instrumentation fix required to obtain evidence"*. L'implémentation a produit :

| Fichier | Nature | Scope |
|---|---|---|
| `playback-compat.ts` (62 lignes) | Classification de delivery + construction des args ffmpeg | **Correction ticket** |
| `media-prober.ts` (45 lignes) | Service ffprobe complet | **Correction ticket** |
| `probe-cache.ts` (21 lignes) | Cache avec TTL 24h | **Correction ticket** |
| `playback-session-store.ts` (43 lignes) | Session store | **Correction ticket** |
| `playback.ts` (477 lignes, réécrit) | Route complète refactorisée | Partiellement instrumentation |
| 7 fichiers de tests + E2E | Suite de tests complète | **Correction ticket** |

Ces services constituent la **correction** du problème T079/T080, pas son diagnostic. Ils seront potentiellement en conflit ou redondants avec le ticket de correction qui suivra.

### Bloquant 3 — Critères d'acceptation non satisfaits

Le ticket liste 11 critères. Aucun n'est satisfait avec des preuves réelles :

- [ ] Real iPhone/Safari stream traced end-to-end → non fait
- [ ] Actual upstream container/codecs known → non fait
- [ ] Actual compatibility mode selected known → non fait
- [ ] ffmpeg execution result known → non fait
- [ ] HTTP/MIME output delivered by compat gateway known → non fait
- [ ] Compat output is valid media known → non fait
- [ ] Safari media error/event evidence captured → non fait
- [ ] Railway ffmpeg/ffprobe verified (not assumed) → non fait (build config ≠ runtime)
- [ ] Root cause stated unambiguously with evidence → non fait (hypothèse code)
- [ ] Concrete correction plan exists → partiel (multiple candidates)
- [ ] NOT closed merely because unit tests pass → violé

### Mineur — Route diagnostics non protégée

`GET /api/diagnostics/env` est publiquement accessible sur Railway (guard `RAILWAY_ENVIRONMENT` insuffisant). Expose PATH, versions binaires, mémoire disponible. Acceptable temporairement mais doit être retiré avant merge — rappel bien noté dans le rapport, mais bloquant si déployé en production sans suivi immédiat.

---

## Risques éventuels

- **Conflit avec le ticket de correction** : `playback-compat.ts`, `media-prober.ts` et la réécriture de `playback.ts` vont directement entrer en conflit ou dupliquer le travail du ticket suivant.
- **Diagnostic jamais complété** : si ce ticket est approuvé tel quel, les preuves de production ne seront jamais collectées, et le ticket de correction sera basé sur des hypothèses — exactement ce que T080 est censé éviter.
- **Tests valident du code non encore validé en production** : la suite de tests unitaires couvre `classifyDelivery` et `buildFfmpegArgs`, mais ces fonctions n'ont pas encore été confirmées correctes pour les streams réels Xtream (le Candidate 3 mentionne que ffmpeg peut produire une sortie invalide).

---

## Décision

- REQUEST_CHANGES

---

## Actions demandées

### Obligatoire — Collecter les preuves de production manquantes

Le script `diagnose-stream.mjs` est prêt. Il faut maintenant l'exécuter avec une vraie URL Xtream défaillante et remplir les sections 2, 3, 4, 6 du rapport. Pour les sections 1, 5, 7, 8 : déployer sur Railway et tester sur iPhone Safari réel avec Web Inspector connecté.

Le rapport ne peut pas rester avec tous les champs `<PENDING>`. Le diagnostic n'est pas terminé.

### Obligatoire — Retirer le code fonctionnel du scope de ce ticket

Les fichiers suivants dépassent le scope diagnostic et doivent être soit retirés de cette PR, soit déplacés vers le ticket de correction :
- `apps/api/src/services/playback-compat.ts`
- `apps/api/src/services/media-prober.ts`
- `apps/api/src/services/probe-cache.ts`
- `apps/api/src/services/playback-session-store.ts`
- Tous les fichiers `*.test.ts` ajoutés pour ces services
- La réécriture complète de `playback.ts` — conserver uniquement l'instrumentation de logging

Ce ticket doit livrer : instrumentation minimale + preuves collectées + rapport complété. La correction vient après.

### Obligatoire — Compléter la section 8 (Railway runtime)

`nixpacks.toml` confirme la configuration du build, pas la présence au runtime. Déployer, appeler `/api/diagnostics/env`, coller la réponse dans la section 8.

### Recommandé — Reformuler le Candidate 1 comme hypothèse, non comme "CONFIRMED"

Le Candidate 1 est une déduction logiquement valide mais reste une hypothèse jusqu'à ce qu'une trace réelle confirme que la session Safari prend bien le chemin compat dès la première requête. Marquer `CONFIRMED FROM CODE — AWAITING RUNTIME VERIFICATION` plutôt que `CONFIRMED`.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T080/reviews/implementation-review.md
- generated at: 2026-08-14T16:50:42Z

---

# PR Review — T080 — Diagnose production Safari/iOS playback failure after compatibility fallback

## Résumé

T080 est un ticket **diagnostic uniquement**. Le livrable attendu est un rapport de root-cause basé sur des preuves issues d'une vraie session de lecture iPhone/Safari sur Railway, PAS sur une analyse statique du code. L'implémentation livre une infrastructure d'instrumentation complète (routes, services, tests) et un rapport `diagnosis.md` dont les 8 sections de preuves sont intégralement `<PENDING>`. Les critères d'acceptation requis par le ticket ne sont pas satisfaits.

---

## Vérifications effectuées

- Lecture du ticket T080 complet (description, critères d'acceptation)
- Lecture de `runs/T080/diagnosis.md`
- Review de tous les fichiers modifiés sur la branche vs `main` : `playback.ts`, `playback-compat.ts`, `media-prober.ts`, `probe-cache.ts`, `playback-session-store.ts`, `playback-resolver.ts`, `diagnostics.ts`, `PlayerPage.tsx`, `diagnose-stream.mjs`, `nixpacks.toml`
- Vérification de la couverture de test produite
- Comparaison du contenu du rapport `diagnosis.md` avec les critères d'acceptation

---

## Points validés

- **Instrumentation backend cohérente** : `sessionId`, `availabilityId`, `sourceId`, `deliveryMode`, headers upstream/réponse, signature hex, PID/exitCode/stderr ffmpeg — tous loggés et sanitisés (pas de credentials dans les logs).
- **Télémétrie frontend correcte** : `console.warn` dans `PlayerPage.tsx` capture `errorCode`, `readyState`, `networkState`, `urlMode`, `eventSequence` sans exposer de secrets.
- **Script local `diagnose-stream.mjs`** : réplique fidèlement le pipeline production et permettrait de collecter les sections 2/3/4/6 sans Railway.
- **Route `/api/diagnostics/env`** : conception adéquate pour vérifier la présence de ffmpeg/ffprobe au runtime Railway.
- **Candidate 1 logiquement cohérent** : `useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)` implique effectivement que les deux tentatives Safari suivent le même code path. C'est un défaut structurel réel.
- **Structure du rapport** : bien organisée, avec instructions de collecte claires pour chaque section.

---

## Problèmes détectés

### Bloquant 1 — Livrable principal absent : zéro preuve de production

Le ticket stipule explicitement :

> *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis that directly determines the correction ticket."*

Le rapport `runs/T080/diagnosis.md` a **tous les champs de preuve à `<PENDING>`** :

```
Section 1  — sessionId, deliveryMode, ffmpegExitCode, Safari errorCode : <PENDING>
Section 2  — containerFormat, videoCodec, audioCodec, duration :         <PENDING>
Section 3  — classifyDelivery résultat réel :                            <PENDING>
Section 4  — ffmpegPid, exitCode, stderrTail, msToFirstByte :           <PENDING>
Section 5  — responseContentType, httpStatus, Transfer-Encoding :        <PENDING>
Section 6  — outputIsValidMedia, outputContainer :                       <PENDING>
Section 7  — errorCode (URL normale/compat), eventSequence Safari :      <PENDING>
Section 8  — ffmpegPresent, ffmpegVersion (runtime Railway) :            <PENDING>
```

La seule affirmation marquée `CONFIRMED` est le Candidate 1 — une déduction issue du code, présentée comme preuve alors que le ticket interdit explicitement cette approche. Aucune des 11 cases d'acceptation listées dans le ticket n'est cochée.

### Bloquant 2 — Violation de scope : implémentation fonctionnelle dans un ticket purement diagnostique

Le ticket autorise uniquement *"a tiny instrumentation fix required to obtain evidence"*. L'implémentation a produit :

| Fichier | Nature | Scope |
|---|---|---|
| `playback-compat.ts` (62 lignes) | Classification de delivery + construction des args ffmpeg | **Correction ticket** |
| `media-prober.ts` (45 lignes) | Service ffprobe complet | **Correction ticket** |
| `probe-cache.ts` (21 lignes) | Cache avec TTL 24h | **Correction ticket** |
| `playback-session-store.ts` (43 lignes) | Session store | **Correction ticket** |
| `playback.ts` (477 lignes, réécrit) | Route complète refactorisée | Partiellement instrumentation |
| 7 fichiers de tests + E2E | Suite de tests complète | **Correction ticket** |

Ces services constituent la **correction** du problème T079/T080, pas son diagnostic. Ils seront potentiellement en conflit ou redondants avec le ticket de correction qui suivra.

### Bloquant 3 — Critères d'acceptation non satisfaits

Le ticket liste 11 critères. Aucun n'est satisfait avec des preuves réelles :

- [ ] Real iPhone/Safari stream traced end-to-end → non fait
- [ ] Actual upstream container/codecs known → non fait
- [ ] Actual compatibility mode selected known → non fait
- [ ] ffmpeg execution result known → non fait
- [ ] HTTP/MIME output delivered by compat gateway known → non fait
- [ ] Compat output is valid media known → non fait
- [ ] Safari media error/event evidence captured → non fait
- [ ] Railway ffmpeg/ffprobe verified (not assumed) → non fait (build config ≠ runtime)
- [ ] Root cause stated unambiguously with evidence → non fait (hypothèse code)
- [ ] Concrete correction plan exists → partiel (multiple candidates)
- [ ] NOT closed merely because unit tests pass → violé

### Mineur — Route diagnostics non protégée

`GET /api/diagnostics/env` est publiquement accessible sur Railway (guard `RAILWAY_ENVIRONMENT` insuffisant). Expose PATH, versions binaires, mémoire disponible. Acceptable temporairement mais doit être retiré avant merge — rappel bien noté dans le rapport, mais bloquant si déployé en production sans suivi immédiat.

---

## Risques éventuels

- **Conflit avec le ticket de correction** : `playback-compat.ts`, `media-prober.ts` et la réécriture de `playback.ts` vont directement entrer en conflit ou dupliquer le travail du ticket suivant.
- **Diagnostic jamais complété** : si ce ticket est approuvé tel quel, les preuves de production ne seront jamais collectées, et le ticket de correction sera basé sur des hypothèses — exactement ce que T080 est censé éviter.
- **Tests valident du code non encore validé en production** : la suite de tests unitaires couvre `classifyDelivery` et `buildFfmpegArgs`, mais ces fonctions n'ont pas encore été confirmées correctes pour les streams réels Xtream (le Candidate 3 mentionne que ffmpeg peut produire une sortie invalide).

---

## Décision

- REQUEST_CHANGES

---

## Actions demandées

### Obligatoire — Collecter les preuves de production manquantes

Le script `diagnose-stream.mjs` est prêt. Il faut maintenant l'exécuter avec une vraie URL Xtream défaillante et remplir les sections 2, 3, 4, 6 du rapport. Pour les sections 1, 5, 7, 8 : déployer sur Railway et tester sur iPhone Safari réel avec Web Inspector connecté.

Le rapport ne peut pas rester avec tous les champs `<PENDING>`. Le diagnostic n'est pas terminé.

### Obligatoire — Retirer le code fonctionnel du scope de ce ticket

Les fichiers suivants dépassent le scope diagnostic et doivent être soit retirés de cette PR, soit déplacés vers le ticket de correction :
- `apps/api/src/services/playback-compat.ts`
- `apps/api/src/services/media-prober.ts`
- `apps/api/src/services/probe-cache.ts`
- `apps/api/src/services/playback-session-store.ts`
- Tous les fichiers `*.test.ts` ajoutés pour ces services
- La réécriture complète de `playback.ts` — conserver uniquement l'instrumentation de logging

Ce ticket doit livrer : instrumentation minimale + preuves collectées + rapport complété. La correction vient après.

### Obligatoire — Compléter la section 8 (Railway runtime)

`nixpacks.toml` confirme la configuration du build, pas la présence au runtime. Déployer, appeler `/api/diagnostics/env`, coller la réponse dans la section 8.

### Recommandé — Reformuler le Candidate 1 comme hypothèse, non comme "CONFIRMED"

Le Candidate 1 est une déduction logiquement valide mais reste une hypothèse jusqu'à ce qu'une trace réelle confirme que la session Safari prend bien le chemin compat dès la première requête. Marquer `CONFIRMED FROM CODE — AWAITING RUNTIME VERIFICATION` plutôt que `CONFIRMED`.

---

IMPLEMENTATION_FIX_REQUIRED