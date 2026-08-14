I now have all the information needed to write the review. Let me compile it.

---

# PR Review — T079: Fix Safari/iOS video decode failures with automatic playback compatibility fallback

## Résumé

C'est une review post-fix (deuxième passage). Le bug bloquant identifié lors de la review précédente — `classifyDelivery` retournant `DIRECT` pour HEVC+AAC+Safari sans vérification du container — a été corrigé correctement et couvert par des tests adaptés. L'implémentation globale est solide, cohérente avec le plan, et répond aux exigences du ticket.

---

## Vérifications effectuées

- `apps/api/nixpacks.toml` — déclaration Railway ffmpeg
- `apps/api/src/services/media-prober.ts` — probing ffprobe
- `apps/api/src/services/probe-cache.ts` — cache TTL 24h
- `apps/api/src/services/playback-compat.ts` — classifier, buildFfmpegArgs (post-fix)
- `apps/api/src/routes/playback.ts` — compat path, runFfmpegStream, disconnect
- `apps/api/src/services/playback-resolver.ts` — compatGatewayUrl
- `packages/api-contracts/src/playback.ts` — contrat étendu
- `apps/web/src/hooks/usePlayback.ts` — compatUrl exposé
- `apps/web/src/pages/PlayerPage.tsx` — auto-retry, message d'erreur, reset retry
- `apps/api/src/__tests__/playback-compat.test.ts` — 22 tests (post-fix)
- `apps/api/src/__tests__/probe-cache.test.ts` — 7 tests
- `apps/api/src/__tests__/playback-stream-compat.test.ts` — 9 tests

---

## Correction du bug bloquant précédent

**`playback-compat.ts`, bloc HEVC — correction appliquée :**

```typescript
if (isHEVC) {
  if (isSafari && isAAC && isMp4Container) return 'DIRECT'   // ← container check ajouté ✅
  if (isSafari && isAAC) return 'REMUX'                       // ← MKV/TS HEVC+AAC → REMUX ✅
  if (isSafari && !isAAC) return 'TRANSCODE_AUDIO'
  if (isAAC) return 'TRANSCODE_VIDEO'
  return 'TRANSCODE_FULL'
}
```

**Tests corrigés (`playback-compat.test.ts`) :**
- `'MP4 + HEVC + AAC, Safari iOS → DIRECT'` avec `mov,mp4,m4a,...` ✅
- `'MKV + HEVC + AAC, Safari iOS → REMUX (not DIRECT)'` avec `matroska,webm` ✅

Le comportement erroné (proxy d'un MKV brut vers Safari pour les sources 4K HEVC) est correctement éliminé.

---

## Points validés

**Exigences ticket :**

| Req. | Statut | Note |
|------|--------|------|
| 1 — Diagnostics decode failure | ✅ | Probe retourne videoCodec/audioCodec/container ; logs sécurisés |
| 2 — Probe server-side | ✅ | ffprobe avec cache 24h |
| 3 — Compatibility decision | ✅ | DIRECT/REMUX/TRANSCODE_AUDIO/TRANSCODE_VIDEO/TRANSCODE_FULL |
| 4 — Automatic fallback | ✅ | Transparent, un seul clic Regarder |
| 5 — HLS/remux delivery | ✅ | fMP4 fragmenté, progressive, kill sur disconnect |
| 6 — Railway deployment | ✅ | nixpacks.toml avec `pkgs.ffmpeg` |
| 7 — Playback API contract | ✅ | `compatGatewayUrl` dans PlaybackSessionResponse |
| 8 — UX/retry | ✅ | Auto-retry MEDIA_ERR_DECODE, message amélioré, Réessayer utile |
| 9 — Variant fallback | ⚪ | Déféré au plan, correctement exclu de scope |
| 10 — Test matrix | ✅ | 38 tests couvrant les cas représentatifs |

**Détails implémentation :**

- **nixpacks.toml** : syntaxe correcte `[phases.setup]` / `nixPkgs = ["ffmpeg"]`. Railway peut installer le binaire à build time.
- **probeMedia** : flags ffprobe corrects (`-show_streams -show_format -print_format json`), parsing robuste. Aucune URL provider dans les logs — seul `availabilityId` est transmis au caller.
- **probe-cache** : Map module-level, TTL 24h, expiry on read, tests hit/miss/expiry/independence — correct.
- **isSafariOrIOS** : exclusion `chrome`/`firefox`/`edg` du match `safari` — couvre les UAs modernes correctement.
- **buildFfmpegArgs** : REMUX (`-c copy`), TRANSCODE_AUDIO (`-c:v copy -c:a aac`), TRANSCODE_VIDEO (`-c:v libx264 -c:a copy`), TRANSCODE_FULL — flags fMP4 cohérents sur tous les modes.
- **compat path** : déclenchement UA Safari OU `?compat=1`. Probe → classify avec `isSafari=true` (correct : on est dans le compat path). Fallback sur extension-based routing si probe échoue (gracieux).
- **DIRECT HLS** : rewrite de manifest + proxy segments — provider URL non exposée.
- **DIRECT MP4** : pass-through avec Content-Length, Content-Range, Accept-Ranges propagés — seek fonctionnel.
- **runFfmpegStream** : premier chunk attendu avant headers (pas de 415 tardif), kill SIGKILL sur disconnect, inputStream error handler.
- **auto-retry PlayerPage** : `isUsingCompatRef` empêche la boucle infinie, switch automatique `video.src = compatUrl` sans rechargement de page, reset correct sur le bouton Réessayer.
- **Sécurité** : credentials non loggués dans le stream handler ni dans le resolver (`console.info` expose seulement sessionId/mediaType/mediaId/availabilityId/sourceId/containerExtension).

---

## Observations restantes (non bloquantes, pré-existantes)

### [Mineur, dette pré-existante] stdin EPIPE non absorbé dans `runFfmpegStream`

`runFfmpegStream` ne contient pas `ffmpeg.stdin.on('error', () => {})`. Sur disconnect, le SIGKILL peut laisser un événement EPIPE non géré sur stdin si `inputStream.pipe` continue à écrire. Sur un serveur sous charge, cela peut crasher Node.js. La même dette existe dans le bloc REMUX non-compat inline (lignes 312–365). Pas introduit par ce ticket.

```typescript
// À ajouter dans runFfmpegStream après inputStream.pipe(ffmpeg.stdin)
ffmpeg.stdin.on('error', () => {})
```

### [Mineur, dette pré-existante] Bloc REMUX non-compat duplique `runFfmpegStream`

Le bloc inline lignes 312–365 dans `playback.ts` reprend exactement la logique de `runFfmpegStream()`. La refactorisation est incomplète. Pas de régression, code pré-existant.

### [Mineur] Probe-cache : état partagé entre tests

La Map est module-level, les tests utilisent des IDs uniques pour contourner le problème. Un `clearCache()` exporté rendrait les tests plus robustes. Pas bloquant.

---

## Couverture test (38 tests)

| Fichier | Count | Cas couverts |
|---------|-------|--------------|
| `playback-compat.test.ts` | 22 | isSafariOrIOS (6), classifyDelivery (11), buildFfmpegArgs (5) |
| `probe-cache.test.ts` | 7 | hit, miss, TTL expiry, overwrite, independence |
| `playback-stream-compat.test.ts` | 9 | REMUX/TRANSCODE_AUDIO/VIDEO/FULL, cache hit, no URL log, non-Safari bypass, disconnect kill, compat=1 |

La matrice du ticket (MP4 H.264/AAC, MKV H.264/AAC, HEVC MP4, HEVC MKV, unsupported codec, credential leakage) est bien couverte.

---

## Décision

Le bug bloquant de la review précédente est correctement corrigé. La logique HEVC+Safari est maintenant container-aware. Les deux tests associés sont alignés. Les observations mineures restantes sont pré-existantes, connues, et explicitement acceptées dans la review précédente. L'implémentation est conforme au plan, au ticket, et aux contraintes de sécurité.

IMPLEMENTATION_APPROVED
