# PR Review — T082: Cross-platform web playback standardisation

## Résumé

L'implémentation couvre correctement l'architecture principale du ticket : probe-first, HLS pipeline, browser-agnostic classification, routes HLS, startup checks Railway, et unification frontend Movie/Episode. La logique centrale est saine et les tests de l'HLS session store sont complets. Cependant, un bug bloquant subsiste dans le flux de retry frontend, et deux déviations significatives du plan méritent correction avant approbation.

---

## Vérifications effectuées

- `runs/T082/diagnosis.md` — analysé
- `apps/api/src/services/hls-session-store.ts` — complet
- `apps/api/src/services/playback-compat.ts` — classifyDelivery + buildFfmpegArgs
- `apps/api/src/services/playback-resolver.ts` — probe, fallback, session creation
- `apps/api/src/routes/playback.ts` — DIRECT, HLS playlist, HLS segment, segment proxy
- `apps/api/src/services/availability-resolver.ts` — codecCompatibilityScore
- `apps/api/src/services/media-prober.ts` — ffprobe wrapping
- `apps/api/src/services/probe-cache.ts` — TTL 24h
- `apps/api/src/services/playback-session-store.ts` — DeliveryMode stocké
- `apps/api/src/index.ts` — startup checks ffmpeg/ffprobe/tmpdir
- `apps/api/nixpacks.toml` — ffmpeg présent (inclut ffprobe)
- `packages/api-contracts/src/playback.ts` — DeliveryMode, PlaybackProbeResult
- `apps/web/src/hooks/usePlayback.ts` — deliveryMode exposé, compatUrl supprimé
- `apps/web/src/pages/PlayerPage.tsx` — unification, HLS.js, retry
- `apps/api/src/services/__tests__/hls-session-store.test.ts` — 13 tests
- `apps/api/src/routes/__tests__/playback-gateway.test.ts` — DIRECT, HLS, credentials
- `e2e/tests/playback.spec.ts` — smoke test

---

## Points validés

**Architecture probe-first correcte**
`classifyDelivery()` est entièrement browser-agnostic, déterminé uniquement par les codec/container réels. L'ordre de priorité `DIRECT` → `HLS_REMUX` → `HLS_TRANSCODE_AUDIO` → `HLS_TRANSCODE_FULL` est correct et appliqué avant la création de session.

**HLS session store robuste**
- Création `mkdtemp` isolée par session.
- SEGMENT_RE empêche le path traversal (`/^seg\d{5}\.ts$/`).
- Double défense en profondeur : regex + `startsWith(tempDir + '/')`.
- Nettoyage TTL (2h) par `setInterval` avec `unref()` pour ne pas bloquer Node.
- `kill('SIGKILL')` + `rm -rf` à l'expiration.
- Accumulation limitée à 500 segments.
- Playlist rewrite : supprime le chemin absolu temp, expose `/api/playback/session/:id/segments/...`.

**Routes HLS correctes**
- `/playback/stream/:id` retourne 409 pour les modes HLS. ✓
- `/playback/session/:id/master.m3u8` : 404 (not_ready), 410 (gone/expired), 200 avec MIME `application/vnd.apple.mpegurl` et `Cache-Control: no-cache`. ✓
- `/playback/session/:id/segments/:filename` : 400 (pattern invalide), stat avant envoi, `video/MP2T`, `Content-Length`. ✓
- Credential safety : les URL provider n'apparaissent pas dans les playlists. ✓

**Railway readiness**
- Startup check `ffmpeg -version` + `ffprobe -version` → `exit(1)` si absent. ✓
- Startup check tmpdir writability. ✓
- `nixpacks.toml` contient `ffmpeg` (le package nix inclut ffprobe). ✓

**Frontend unifié**
- `compatUrl` supprimé de `usePlayback`. ✓
- `deliveryMode !== 'DIRECT'` → hls.js ; Safari → HLS natif. ✓
- `Regarder` déclenche la lecture sans sélecteur technique. ✓
- HLS.js chargé dynamiquement (import lazy). ✓

**Codec scoring**
`codecCompatibilityScore()` : H.264 → 0, HEVC → 1, autres → 2. Tiebreaker de plus basse priorité, n'affecte pas la langue. ✓

**Suppression du compat path**
`isSafariOrIOS()` supprimé. La branche `?compat=1` est supprimée. Le retry client-side sur `MEDIA_ERR_DECODE` est retiré. ✓

**Tests unitaires**
`hls-session-store.test.ts` : SEGMENT_RE, création session, playlist rewrite, no-credential, path traversal, segment count limit, ffmpeg exit failure. Couverture solide.
`playback-gateway.test.ts` : DIRECT pass-through, Range forwarding, 409 HLS, 410 expired, credential safety playlist, path traversal. Couverture correcte.

---

## Problèmes détectés

### [BLOQUANT] Bug de retry frontend : HLS ne se ré-attache pas via hls.js

**Fichier** : `apps/web/src/pages/PlayerPage.tsx`, lignes 231–246

```tsx
onRetry={() => {
  eventLogRef.current = []
  setVideoError(null)
  const video = videoRef.current
  if (video && gatewayUrl) {
    video.src = gatewayUrl   // ← PROBLÈME
    video.load()
    video.play().catch(() => {})
  }
}}
```

Pour les sessions HLS (`deliveryMode !== 'DIRECT'`), `gatewayUrl` pointe vers `master.m3u8`. Sur Chrome/Android, assigner directement `video.src = master.m3u8` sans passer par hls.js ne fonctionnera pas — c'est le seul cas où le retry est essentiel. De plus, si la session HLS est expirée (410), le retry rejoue l'URL cassée sans en créer une nouvelle.

**Critère d'acceptance non satisfait** : "Retry creates a fresh valid playback attempt rather than replaying a known-broken target."

**Correction attendue** : Le retry doit appeler `switchVariant(availabilityId)` (qui déclenche un nouveau `resolvePlayback`) plutôt que de manipuler `video.src` directement. Après le resolve, le `useEffect` principal attachera correctement hls.js ou définira `video.src` selon le mode.

```tsx
onRetry={() => {
  eventLogRef.current = []
  setVideoError(null)
  if (availabilityId) switchVariant(availabilityId)
}}
```

---

### [SIGNIFICATIF] Fallback extension pour .mp4 → DIRECT réintroduit la cause racine diagnostiquée

**Fichier** : `apps/api/src/services/playback-resolver.ts`, lignes 84–90

```ts
function extensionFallbackMode(containerExtension: string): DeliveryMode {
  const ext = containerExtension.toLowerCase()
  if (ext === 'mp4' || ext === 'm4v') return 'DIRECT'   // ← HEVC dans .mp4 passe en DIRECT
  ...
}
```

Le diagnostic documente explicitement : "A provider can label a stream `.mp4` while it actually contains HEVC video or AC3 audio that browsers cannot decode." La classification `DIRECT` pour `.mp4` en cas d'échec du probe réintroduit exactement ce comportement, silencieusement, pour tous les streams dont ffprobe ne peut pas atteindre l'URL au moment du resolve.

Le plan préconisait : "Raise 503 if probing fails and no fallback is possible." L'implémentation choisit une dégradation gracieuse — acceptable en principe — mais `DIRECT` pour `.mp4` est le pire choix de fallback, pas le plus sûr. Le fallback raisonnable serait `HLS_TRANSCODE_FULL` (coûteux mais browser-compatible) ou une erreur explicite.

**Correction proposée** : Remplacer le retour `DIRECT` pour `.mp4`/`.m4v` par `HLS_TRANSCODE_FULL` en fallback, ou logger un avertissement explicite et retourner `HLS_TRANSCODE_FULL` pour tout container ambigu.

```ts
function extensionFallbackMode(containerExtension: string): DeliveryMode {
  const ext = containerExtension.toLowerCase()
  if (ext === 'm3u8' || ext === 'm3u') return 'DIRECT'      // HLS natif — safe sans probe
  return 'HLS_TRANSCODE_FULL'                                // tout le reste : safe mais coûteux
}
```

---

### [MINEUR] E2E test non étendu selon le plan

**Fichier** : `e2e/tests/playback.spec.ts`

Le plan prévoyait : "assert response has `deliveryMode` field, fetch playlist if HLS, assert playlist contains no provider credentials." Le test actuel ne vérifie pas `deliveryMode` dans la réponse (`session` est typé sans ce champ). La propriété est dans le contrat API mais non assertée en E2E.

---

### [MINEUR] ffmpeg exit code/stderrTail non logué (observabilité)

**Fichier** : `apps/api/src/services/hls-session-store.ts`, ligne 84–89

Le plan requiert : "ffmpeg exit: `hlsSessionId`, `exitCode`, `stderrTail`" comme log structuré. Le handler `proc.on('close')` stocke ces informations dans `s.failedReason` mais ne les logue pas. La gateway logue "HLS session gone or failed" sans code de sortie ni stderrTail.

---

### [MINEUR] Diagnosis basée sur analyse de code, pas sur captures live

**Fichier** : `runs/T082/diagnosis.md`

Le ticket exige : "Trace at least one real failing Movie and one failing Episode end-to-end" avec captures réelles (ffprobe JSON, HTTP status, Content-Type, premiers bytes, browser error codes). Le diagnosis existant est une analyse statique du code pré-T082, sans données capturées. Le script `diagnose-stream.mjs` n'a pas été étendu comme prévu par le plan. C'est acceptable en environnement autonome sans accès à la production, mais la documentation ne satisfait pas formellement le critère "Root cause is documented with evidence."

---

### [INFO] `getSegment` ne retourne jamais `not_ready` depuis le store

**Fichier** : `apps/api/src/services/hls-session-store.ts`, type `SegmentResult`

Le type `SegmentResult` inclut `{ status: 'not_ready' }` mais `getSegment` ne le retourne jamais — la détection "segment pas encore écrit" est effectuée dans la route via `stat()`. Le type contract est trompeur mais sans conséquence fonctionnelle.

---

## Risques éventuels

**Race condition légère** : entre `getHlsSession` et l'utilisation de `entry.tempDir`, la session pourrait expirer. Le TTL check inline dans `getHlsSession` minimise la fenêtre mais ne l'élimine pas. Acceptable pour un MVP.

**Credentials dans les args process** : `ffprobe` et `ffmpeg` reçoivent `providerUrl` (avec credentials Xtream) en argument. Ces arguments sont visibles via `ps aux`. Sur Railway (containers isolés), le risque est très faible, mais mérite d'être noté.

**DIRECT pour HLS natif (m3u8)** : La route DIRECT proxifie les segments provider-native HLS via un endpoint séparé `/playback/stream/:id/segment?uri=<base64>`. L'URI décodée n'est pas validée contre le domaine provider de la session, ce qui permettrait à un attaquant authentifié de proxifier des URLs arbitraires. Risque faible en contexte single-user mais notable.

---

## Décision

L'architecture centrale est correcte et bien implémentée. La correction requise est ciblée :

1. **Bloquant** : Corriger le retry HLS dans `PlayerPage.tsx` (5 lignes).
2. **Significatif** : Corriger `extensionFallbackMode` pour ne pas retourner `DIRECT` sur `.mp4` (2 lignes).
3. **Mineur** : Ajouter assertion `deliveryMode` dans l'E2E test.
4. **Mineur** : Logger ffmpeg exit code + stderrTail dans le handler `proc.on('close')`.

IMPLEMENTATION_FIX_REQUIRED
