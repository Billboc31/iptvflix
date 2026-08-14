# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T080/reviews/implementation-review.md
- generated at: 2026-08-14T16:21:27Z

---

I now have a complete picture of both cycles. Let me write the review.

---

# PR Review — T080 (Attempt 2)

## Résumé

Le coder-attempt-2 a traité les deux bloquants de la première review :
- **Bloquant 2 résolu** : le legacy extension path (`playback.ts:424-453`) appelle désormais `runFfmpegStream('REMUX', ...)` au lieu de spawner ffmpeg avec stderr silencieux.
- **Non-bloquant résolu** : la "Security Limitation" de la route `/api/diagnostics/env` est documentée dans `diagnosis.md` Section 8.

**Bloquant 1 toujours présent** : `diagnosis.md` contient zéro evidence de production. Toutes les sections 1–8 restent à `<PENDING>`. La cause racine n'est pas énoncée. Aucun critère d'acceptance exigeant de l'evidence réelle n'est satisfait. Le coder reconnaît explicitement que ce blocker "cannot be resolved by code changes" et "requires human action".

---

## Vérifications effectuées

- Lecture complète de `runs/T080/diagnosis.md` (version mise à jour)
- Lecture complète de `apps/api/src/routes/playback.ts` (version mise à jour)
- Lecture complète de `apps/api/src/routes/diagnostics.ts`
- Lecture de `runs/T080/implementation-output.md` (changelog coder-attempt-2)
- Vérification de la conformité aux critères d'acceptance du ticket

---

## Points validés dans coder-attempt-2

**Legacy ext path — Bloquant 2 corrigé (lignes 424-453)**

La refonte est propre :
```typescript
const outputStream = await runFfmpegStream(
  streamBody,
  'REMUX',
  { ...logCtx, legacyExtPath: true },
  app,
  (cb) => request.raw.on('close', cb),
)
```
Le tag `legacyExtPath: true` distingue ce chemin en Railway logs. Logging identique au compat path : pid, args sanitisés, exit code/signal, stderr tail, msToFirstByte, disconnect. Bloquant 2 est entièrement résolu.

**Section 8 diagnosis.md — Non-bloquant résolu**

Le paragraphe "Security Limitation — Unauthenticated diagnostics route" est présent, factuel, et mentionne explicitement que la route doit être supprimée dans le ticket correctif.

**Qualité générale du code — confirmée inchangée**

- `runFfmpegStream()` : correct. Sanitisation args, capture stderr, exit log, msToFirstByte, SIGKILL sur disconnect.
- Peek `tee()` (lignes 312-323) : correct. Les deux branches `tee()` reçoivent bien tous les bytes (comportement WHATWG spec). `reader.cancel()` n'annule pas `mainStream`. Fallback `catch {}` si `tee()` indisponible.
- `diagnostics.ts` : `execFile` (pas `exec`), timeout 10s sur chaque subprocess, guard `RAILWAY_ENVIRONMENT`. Correct.
- `logCtx` corrélé sur toutes les lignes de log dans les deux chemins.

---

## Problèmes détectés

### Bloquant 1 — Aucune evidence de production collectée (inchangé)

Les critères d'acceptance suivants du ticket ne sont **pas** satisfaits :

| Critère | État |
|---|---|
| Real failing iPhone/Safari stream traced end-to-end | ❌ `<PENDING>` |
| Actual upstream container/codecs known from ffprobe | ❌ `<PENDING>` |
| Actual compatibility mode selected and justified | ❌ `<PENDING>` |
| ffmpeg/remux execution result known | ❌ `<PENDING>` |
| Actual HTTP/MIME/output delivered to Safari known | ❌ `<PENDING>` |
| Generated compat output independently validated | ❌ `<PENDING>` |
| Safari MediaError/event evidence captured | ❌ `<PENDING>` |
| Railway ffmpeg/ffprobe verified (not assumed) | ❌ `<PENDING>` |
| Root cause stated unambiguously with evidence | ❌ Candidates ranked, not confirmed |

Le ticket stipule explicitement : *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis."*

Le `diagnosis.md` actuel est un template de collecte, pas un rapport de diagnostic. La Section 9 liste des hypothèses candidates — valeur analytique réelle — mais ce ne sont pas des causes racines confirmées par evidence.

### Observation structurelle — Ce bloquant est opérationnel, pas un problème de code

Le coder-attempt-2 reconnaît explicitement l'impossibilité de résoudre ce bloquant sans accès humain. La collecte d'evidence nécessite :
1. Déploiement de la branche sur Railway
2. Appel à `GET /api/diagnostics/env` pour vérifier ffmpeg/ffprobe
3. Session Safari réelle sur iPhone avec Railway log stream ouvert
4. Capture des logs Web Inspector
5. Remplissage des sections PENDING du rapport

Ces cinq étapes sont des opérations humaines/opérateur. Un cycle AI supplémentaire ne peut pas les exécuter.

---

## Décision

Les critères d'acceptance du ticket sont non satisfaits pour des raisons opérationnelles (pas de défaut de code). L'instrumentation est complète et correcte. Le ticket est bloqué sur une action humaine, pas sur une action AI.

**IMPLEMENTATION_FIX_REQUIRED**

---

## Actions demandées

### Obligatoire (bloquant — action humaine requise)

**Déployer sur Railway et collecter l'evidence** :

1. Merger ou déployer la branche `ticket/T080-diagnose-production-safari-ios-playback-failure-af` sur Railway
2. Appeler `GET /api/diagnostics/env` → vérifier `ffmpegPresent`, `ffmpegVersion`, `ffprobePresent`, `railwayPath`
3. Ouvrir Railway log stream (`railway logs -t --service api`)
4. Naviguer vers un Xtream Movie/Episode défaillant sur iPhone Safari avec Safari Web Inspector connecté
5. Capturer : logs Railway (sessionId, deliveryMode, upstreamFirstBytesHex, ffmpegExitCode, ffmpegStderrTail), Web Inspector console.warn (errorCode, readyState, networkState, urlMode, eventSequence)
6. Remplir les sections 1–8 de `runs/T080/diagnosis.md` avec les valeurs observées
7. Rédiger la Section 9 comme une **cause racine unique non-ambiguë**, de type : *"ffmpeg est absent du PATH Railway" ou "classifyDelivery retourne DIRECT pour un flux TS que Safari ne peut pas décoder"*, avec l'evidence à l'appui

**Ce sont les seules actions qui permettent de satisfaire les critères d'acceptance du ticket.**

### Recommandation process

Étant donné que ce bloquant ne peut pas être résolu par un agent AI seul, il est recommandé de :
- Escalader cette étape à l'opérateur/propriétaire du projet pour exécution manuelle
- Une fois l'evidence collectée, mettre à jour `diagnosis.md` et rouvrir la review
- Alternativement, si un accès Railway automatisé est disponible dans le pipeline, configurer un agent avec cet accès

---

IMPLEMENTATION_FIX_REQUIRED
