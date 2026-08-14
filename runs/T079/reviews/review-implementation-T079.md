# PR Review — T079: Fix Safari/iOS video decode failures with automatic playback compatibility fallback

## Résumé

L'implémentation est bien structurée et couvre la majorité des exigences du ticket : nixpacks.toml, media-prober, probe-cache, classifier, compat path dans le stream handler, extension du contrat API, auto-retry frontend, et 37 tests. Un seul problème fonctionnel bloquant est identifié : la classification HEVC+AAC+Safari ignore le container, ce qui viole le plan et ferait revenir à un MKV brut sur Safari dans le cas HEVC non-MP4.

---

## Vérifications effectuées

- `nixpacks.toml` — déclaration ffmpeg pour Railway
- `media-prober.ts` — spawn ffprobe, parse JSON, log sécurisé
- `probe-cache.ts` — TTL 24h, module-level Map, getProbe/setProbe
- `playback-compat.ts` — isSafariOrIOS, classifyDelivery, buildFfmpegArgs
- `playback.ts` — compat path, runFfmpegStream, disconnect handling, probe caching
- `playback-resolver.ts` — compatGatewayUrl dans la réponse
- `packages/api-contracts/src/playback.ts` — compatGatewayUrl ajouté
- `usePlayback.ts` — compatUrl exposé
- `PlayerPage.tsx` — auto-retry sur MEDIA_ERR_DECODE, message d'erreur amélioré
- Tests : playback-compat.test.ts, probe-cache.test.ts, playback-stream-compat.test.ts

---

## Points validés

- **Railway** : `nixpacks.toml` avec `pkgs.ffmpeg` — correct, explicite, sans magic binary.
- **probeMedia** : spawn ffprobe avec bons flags, parsing correct `streams`/`format`, erreur rejetée proprement. Le raw provider URL n'est jamais loggué (seul `availabilityId` l'est dans le caller).
- **probe-cache** : TTL correct (24h), expiry on read, setProbe overwrite, tests couvrant hit/miss/expiry/independence.
- **isSafariOrIOS** : exclut Chrome (`chrome`), Firefox (`firefox`) et Edge (`edg`) du match `safari` — correct pour les UA modernes.
- **buildFfmpegArgs** : arguments corrects pour chaque mode, fragmented MP4 output flags cohérents.
- **Compat path** : activé par Safari UA OU `?compat=1`. Probe → classify → dispatch. Fallback gracieux si probe échoue (extension-based routing).
- **DIRECT HLS** : rewrite de manifest + proxy de segments, provider URL non exposée.
- **DIRECT MP4** : pass-through avec Content-Length et Content-Range propagés.
- **REMUX / TRANSCODE_*** : runFfmpegStream, premier chunk attendu avant d'envoyer les headers, kill sur disconnect.
- **compatGatewayUrl** : présent dans le contrat, dans le resolver, dans usePlayback, dans PlayerPage.
- **Auto-retry frontend** : sur MEDIA_ERR_DECODE ou MEDIA_ERR_SRC_NOT_SUPPORTED, switch automatique vers compatUrl sans action utilisateur. isUsingCompatRef évite la boucle infinie.
- **Message d'erreur** : `'Impossible de lire ce contenu sur ce navigateur'` remplace le dead-end générique.
- **Retry** : reset de isUsingCompatRef, reload depuis gatewayUrl principal.
- **Tests** : 37 tests — coverage classifier, cache, routing compat (REMUX/TRANSCODE_AUDIO/TRANSCODE_VIDEO/TRANSCODE_FULL/cache hit/non-Safari bypass/client disconnect/no URL in logs).
- **Sécurité** : credentials non loggués dans le stream handler.

---

## Problèmes détectés

### [BLOQUANT] classifyDelivery : HEVC+AAC+Safari → DIRECT sans vérification du container

**Fichier** : `apps/api/src/services/playback-compat.ts`, ligne 35

**Code actuel :**
```typescript
if (isHEVC) {
    if (isSafari && isAAC) return 'DIRECT'   // ← aucune vérification du container
    if (isSafari && !isAAC) return 'TRANSCODE_AUDIO'
    ...
}
```

**Problème :** Le plan spécifie explicitement "HEVC/H.265 + AAC **in MP4** on iOS/macOS Safari → DIRECT". L'implémentation ignore cette condition. Pour une source HEVC+AAC dans un container MKV ou TS avec un client Safari, le mode DIRECT est retourné — ce qui provoque un proxy du flux MKV brut vers Safari, que Safari ne sait pas décoder.

**Impact :** Cas réel : source IPTV en MKV/HEVC+AAC (fréquent pour la 4K). Safari reçoit un MKV brut → `Erreur de décodage vidéo`, exactement le problème que ce ticket doit corriger.

**Test également erroné** (`playback-compat.test.ts`, ligne 58–60) :
```typescript
it('any + HEVC + AAC, Safari iOS → DIRECT', () => {
    expect(classifyDelivery(info('hevc', 'aac', 'matroska,webm'), true)).toBe<DeliveryMode>('DIRECT')
})
```
Ce test valide un comportement incorrect : `matroska,webm` + HEVC + AAC + Safari doit être `REMUX`, pas `DIRECT`.

**Correction requise dans `playback-compat.ts` :**
```typescript
if (isHEVC) {
    if (isSafari && isAAC && isMp4Container) return 'DIRECT'   // HEVC+AAC déjà en MP4/MOV → direct
    if (isSafari && isAAC) return 'REMUX'                       // HEVC+AAC hors MP4 → remux vers fMP4
    if (isSafari && !isAAC) return 'TRANSCODE_AUDIO'
    if (isAAC) return 'TRANSCODE_VIDEO'
    return 'TRANSCODE_FULL'
}
```

**Correction requise dans `playback-compat.test.ts` :**
```typescript
it('any + HEVC + AAC in non-MP4 container, Safari iOS → REMUX', () => {
    expect(classifyDelivery(info('hevc', 'aac', 'matroska,webm'), true)).toBe<DeliveryMode>('REMUX')
})

it('HEVC + AAC in MP4 container, Safari iOS → DIRECT', () => {
    expect(classifyDelivery(info('hevc', 'aac', 'mov,mp4,m4a,3gp,3g2,mj2'), true)).toBe<DeliveryMode>('DIRECT')
})
```

---

## Risques éventuels

### [Mineur] stdin EPIPE non géré dans runFfmpegStream et la branche non-compat REMUX

Lorsqu'un client se déconnecte, ffmpeg est killed (SIGKILL). Node.js émet ensuite un événement `error` (EPIPE) sur `ffmpeg.stdin` quand le inputStream tente d'y écrire après la mort du process. Il n'y a pas de `ffmpeg.stdin.on('error', () => {})` dans `runFfmpegStream()` ni dans le bloc REMUX non-compat inline. En pratique, ce problème est masqué par le fait que ffmpeg s'arrête rapidement, mais sur un serveur sous charge, un EPIPE non géré peut crasher le process Node.js.

Ce bug est pré-existant dans le bloc REMUX non-compat (il n'est pas introduit par ce ticket). Il est acceptable de le noter comme dette technique sans bloquer la review — mais le nouveau `runFfmpegStream()` devrait idéalement l'inclure :

```typescript
ffmpeg.stdin.on('error', () => {})  // absorb EPIPE on disconnect
```

### [Mineur] Duplication du bloc ffmpeg inline dans la branche non-compat

La branche non-compat (lignes 319–365 dans `playback.ts`) duplique exactement la logique de `runFfmpegStream()`. Ce n'est pas une régression (le code pré-existait), mais puisque `runFfmpegStream()` a été extrait, la refactorisation pourrait être complète. Acceptable dans ce ticket.

### [Mineur] Probe-cache : state partagé entre tests

`probe-cache.ts` utilise une `Map` module-level. Les tests utilisent des IDs uniques, ce qui évite les interférences en pratique, mais un `clearCache()` exporté permettrait des tests plus robustes. Pas bloquant.

---

## Décision

L'implémentation est de bonne qualité dans l'ensemble, mais le bug HEVC+container dans `classifyDelivery` est fonctionnellement bloquant : il reproduirait exactement le problème de decode error sur Safari pour les sources 4K HEVC en MKV, qui sont le cas d'usage le plus courant pour ce format. La correction est localisée (3–4 lignes de code + 2 tests à mettre à jour) et sans impact sur les autres modes.

IMPLEMENTATION_FIX_REQUIRED
