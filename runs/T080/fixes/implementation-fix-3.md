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
