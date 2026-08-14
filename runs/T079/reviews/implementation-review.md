---

## Review T079 — Résultat : `IMPLEMENTATION_FIX_REQUIRED`

L'implémentation est solide dans l'ensemble (nixpacks, prober, cache, classifier, compat path, contrat API, auto-retry frontend, 37 tests), mais un bug fonctionnel bloquant a été identifié.

---

### Problème bloquant — `classifyDelivery` : HEVC+AAC+Safari → DIRECT sans vérification du container

**Fichier** : `apps/api/src/services/playback-compat.ts`, ligne 35

Le plan spécifie : *"HEVC/H.265 + AAC **in MP4** on iOS/macOS Safari → DIRECT"*. L'implémentation retourne `DIRECT` pour HEVC+AAC+Safari **quel que soit le container**. Résultat : une source HEVC+AAC en MKV (cas 4K typique) reçue par Safari serait proxiée telle quelle → `Erreur de décodage vidéo`, exactement le problème du ticket.

**Correction dans `playback-compat.ts` :**
```typescript
if (isHEVC) {
    if (isSafari && isAAC && isMp4Container) return 'DIRECT'  // déjà en MP4 → ok
    if (isSafari && isAAC) return 'REMUX'                      // MKV/TS HEVC+AAC → fMP4
    if (isSafari && !isAAC) return 'TRANSCODE_AUDIO'
    ...
}
```

Le test `'any + HEVC + AAC, Safari iOS → DIRECT'` avec `matroska,webm` valide également le mauvais comportement et doit être corrigé en deux cas : MP4 → DIRECT, non-MP4 → REMUX.

---

### Observations mineures (non bloquantes)

- **stdin EPIPE** : pas de `ffmpeg.stdin.on('error', () => {})` dans `runFfmpegStream()` → crash potentiel sur disconnect sous charge. Pré-existant dans le bloc REMUX non-compat.
- **Duplication** : le bloc REMUX non-compat (lignes 319–365) duplique `runFfmpegStream()` inline. Refactorisation incomplète, acceptable.

IMPLEMENTATION_FIX_REQUIRED
