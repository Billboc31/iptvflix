## Résultat de la review

**Décision : `IMPLEMENTATION_FIX_REQUIRED`**

---

### Points validés

L'architecture centrale est correcte :
- Probe-first via `probeMedia()` + `classifyDelivery()` entièrement browser-agnostic
- HLS session store complet : TTL 2h, SIGKILL + rm -rf, accumulation limitée à 500 segments, path traversal double-défense
- Routes HLS correctes (409 sur `/stream/:id`, 404/410/200 sur `master.m3u8`, Content-Length sur segments)
- Startup checks Railway fonctionnels (ffmpeg/ffprobe + tmpdir)
- Frontend unifié sans sélecteur technique, hls.js attaché correctement pour Chrome
- Credential safety : aucun hostname/credentials provider dans les playlists
- Codec scoring préserve la langue

---

### Problèmes à corriger

**[BLOQUANT] Retry frontend cassé pour HLS sur Chrome** (`PlayerPage.tsx` lignes 231–246)

Le `onRetry` fait `video.src = gatewayUrl; video.load()` directement. Pour les sessions HLS, cela bypasse hls.js — le retry ne fonctionnera pas sur Chrome/Android. De plus, si la session est expirée (410), le retry rejoue l'URL cassée sans en créer une nouvelle.

Correction : appeler `switchVariant(availabilityId)` au lieu de manipuler `video.src`.

**[SIGNIFICATIF] `extensionFallbackMode('.mp4') → DIRECT` réintroduit la cause racine** (`playback-resolver.ts` lignes 84–90)

Sur échec du probe, un `.mp4` HEVC passe silencieusement en `DIRECT` — exactement le scénario diagnostiqué comme root cause. Le fallback sûr est `HLS_TRANSCODE_FULL` pour tout container ambigu.

**[MINEUR]** E2E test ne vérifie pas `deliveryMode` dans la réponse (prévu par le plan).

**[MINEUR]** ffmpeg exit code/stderrTail non logués dans le handler `proc.on('close')` (observabilité incomplète).

---

La review complète est dans `runs/T082/reviews/review-attempt-1.md`.

IMPLEMENTATION_FIX_REQUIRED
