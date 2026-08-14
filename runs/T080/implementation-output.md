## Summary — Coder Attempt 5

**Aucune modification de code produite dans cette tentative.**

La review de l'attempt-4 conclut explicitement :
- Le code d'instrumentation (backend, frontend, script local) est **complet et correct**.
- **Un 5e cycle AI ne peut pas changer la situation** : les critères d'acceptance bloquants nécessitent une action humaine irremplaçable.

### État du code (inchangé depuis attempt-4)

| Fichier | Statut |
|---|---|
| `apps/api/src/routes/playback.ts` | ✅ Instrumentation backend complète |
| `apps/api/src/routes/diagnostics.ts` | ✅ Route `/api/diagnostics/env` correcte |
| `apps/api/src/index.ts` | ✅ Route enregistrée à la ligne 165 |
| `apps/web/src/pages/PlayerPage.tsx` | ✅ Diagnostic frontend complet |
| `apps/api/scripts/diagnose-stream.mjs` | ✅ Script local fidèle au pipeline production |

### Critères d'acceptance — état réel

| Critère | État |
|---|---|
| Real failing iPhone/Safari stream traced end-to-end | ❌ PENDING — nécessite Railway + iPhone Safari |
| Actual upstream container/codecs known | ❌ PENDING — script fourni, requiert URL Xtream réelle |
| Actual compat mode selected and justified | ❌ PENDING — requiert exécution sur flux réel |
| ffmpeg/remux execution result known | ❌ PENDING — requiert exécution sur flux réel |
| HTTP/MIME/output delivered to Safari known | ❌ PENDING — requiert curl/Safari sur déploiement Railway |
| Generated compat output independently validated | ❌ PENDING — requiert exécution sur flux réel |
| Safari MediaError/event evidence captured | ❌ PENDING — requiert iPhone + Web Inspector |
| Railway ffmpeg/ffprobe runtime verified | ❌ PENDING — requiert déploiement Railway |
| Root cause stated unambiguously with evidence | ❌ PENDING — seul Candidate 1 confirmé (structurel) |

### Finding confirmée (Candidate 1 — structurelle)

`playback.ts:207` : `useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)` — pour tout UA Safari/iOS, la requête initiale **et** le retry `?compat=1` suivent le même compat path. Le retry est donc inerte par construction.

### Séquence humaine obligatoire pour compléter ce ticket

1. `node apps/api/scripts/diagnose-stream.mjs --url '<URL_XTREAM_REELLE>' --ext ts` → coller la sortie JSON dans `diagnosis.md` sections 2/3/4/6
2. Déployer la branche sur Railway
3. `GET /api/diagnostics/env` → remplir Section 8 (`ffmpegPresent`, `ffmpegVersion`, `railwayPath`)
4. `railway logs -t --service api` en attente
5. Connecter un iPhone Safari (USB ou Simulator)
6. Naviguer vers un Xtream Movie/Episode défaillant
7. Capturer les Railway logs (`sessionId`, `deliveryMode`, `upstreamFirstBytesHex`, `ffmpegExitCode`, `ffmpegStderrTail`) → Section 1
8. Capturer Web Inspector (`errorCode`, `readyState`, `networkState`, `urlMode`, `eventSequence`) → Section 7
9. Tester depuis curl la réponse HTTP du compat gateway → Section 5
10. Rédiger la cause racine dans Section 9 de `diagnosis.md`
11. Committer `diagnosis.md` complété

### Limites connues

Aucun agent AI ne peut accéder au runtime Railway, aux logs de production, ni à Safari Web Inspector. Ce ticket ne peut être fermé que par exécution humaine de la séquence ci-dessus.
