# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T050/reviews/implementation-review.md
- generated at: 2026-08-13T01:45:57Z

---

I have enough information to write the full review.

---

## PR Review — T050: Secure Web Playback Flow from Selected Availability

### Résumé

L'implémentation couvre l'ensemble des exigences du ticket : endpoint de résolution `/playback/resolve/:mediaType/:mediaId` protégé par JWT, isolation des credentials Xtream/M3U dans les URL de stream, validation server-side des variantes, 17 tests unitaires, page player Web avec reprise de position et sélection de variante, et intégration du suivi de progression. La grande majorité du code est correcte et bien structurée — il y a cependant un bug de cleanup HLS qui impacte directement le critère d'acceptation de changement de variante, et un cas de type source non géré qui peut provoquer un comportement silencieux inattendu.

---

### Vérifications effectuées

- Plan vs. implémentation : tous les fichiers listés dans le plan ont été produits
- Sécurité : isolation des credentials, absence de `streamUrl` dans les DTOs catalogue, réponses d'erreur sans détails provider
- Validation server-side : status UNAVAILABLE → 400, source disabled → 403, ID inconnu → 404, tous mappés à `'Variant not available'` côté client
- Enregistrement des routes dans le scope protégé (JWT `authenticate` hook)
- Frontend : routing, usePlayback, useProgressSync, PlayerPage
- Tests : couverture des 7 scénarios requis par le plan
- Type contracts : `PlaybackSessionResponse` et `AvailabilityVariantResponse` n'exposent aucun champ credential

---

### Points validés

- `POST /playback/resolve/:mediaType/:mediaId` correctement enregistré dans `protectedScope` (`apps/api/src/index.ts:92`)
- `streamUrl` absent de tous les DTOs catalogue ; `PlaybackSessionResponse` est un contrat isolé dans `packages/api-contracts/src/playback.ts`
- `alternatives: AvailabilityVariantResponse[]` ne contient ni `providerItemId` ni `streamUrl`, uniquement des métadonnées de variante
- Le resolver revalide toujours côté serveur même si le client fournit un `availabilityId` explicite — le chemin "explicit ID not in candidates" lève bien un `NotFoundError` via `allRows.find(...)` avant d'accéder à `candidates`
- Les 3 catégories d'erreur sont mappées à des messages génériques sans internals provider dans `apps/api/src/routes/playback.ts:37-46`
- Le logger Fastify (pino) n'est jamais appelé avec `streamUrl` dans le service ni les URL builders — test `secret redaction` vérifié
- `useProgressSync` : debounce 10 s sur `timeupdate`, envoi final sur `ended`, listeners correctement retirés au cleanup
- Bouton Play Movie conditionnel à `availabilityStatus === 'AVAILABLE'` (`MovieDetailPage.tsx:221`)
- Bouton Lire Episode conditionnel à `!isUnavailable` (`EpisodeRow.tsx:46`)
- Route `/player/:mediaType/:mediaId` enregistrée sans AppShell dans `App.tsx:31`
- `hls.js@^1.7.0` présent dans `apps/web/package.json`
- 17 tests couvrant : sélection préférée, variante explicite valide, ID inconnu, status UNAVAILABLE, source disabled, resume position, M3U URL shape, Xtream URL shape, non-logging des credentials, no-candidate error

---

### Problèmes détectés

#### 🔴 Bloquant — HLS instance non détruite au cleanup

**Fichier** : `apps/web/src/pages/PlayerPage.tsx`, lignes 29–53

```typescript
if (streamUrl.includes('.m3u8')) {
  import('hls.js').then(({ default: Hls }) => {
    if (Hls.isSupported()) {
      const hls = new Hls()           // ← instance créée dans .then() async
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
      // cleanup returned to caller below  ← commentaire trompeur
    }
  })
}
return () => {
  video.src = ''                       // ← hls.destroy() jamais appelé
}
```

Quand `streamUrl` change (changement de variante) ou quand le composant est démonté :

1. Le cleanup React exécute `video.src = ''` — l'instance HLS précédente reste active en mémoire et continue à télécharger des segments réseau.
2. Race condition : si React exécute le cleanup avant que la Promise `import('hls.js')` soit résolue, la nouvelle instance HLS sera quand même créée et appellera `hls.attachMedia(video)` sur un composant nettoyé.
3. Lors d'un `switchVariant()`, deux instances HLS (ou plus) peuvent se disputer le même élément `<video>`.

Ce bug affecte directement le critère d'acceptation : *"L'utilisateur peut choisir explicitement une autre variante/availability valide."*

**Correction attendue** — capturer la référence HLS dans une variable du scope de l'effect et l'inclure dans le cleanup :

```typescript
useEffect(() => {
  const video = videoRef.current
  if (!video || !streamUrl) return

  let hlsInstance: import('hls.js').default | null = null
  let cancelled = false

  if (streamUrl.includes('.m3u8')) {
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled) return
      if (Hls.isSupported()) {
        hlsInstance = new Hls()
        hlsInstance.loadSource(streamUrl)
        hlsInstance.attachMedia(video)
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
      }
    }).catch(() => {
      if (!cancelled && video) video.src = streamUrl
    })
  } else {
    video.src = streamUrl
  }

  return () => {
    cancelled = true
    hlsInstance?.destroy()
    video.src = ''
  }
}, [streamUrl])
```

---

#### 🟡 Non-bloquant — Source de type PLEX silencieusement traitée comme M3U

**Fichier** : `apps/api/src/services/playback-resolver.ts`, lignes 131–141

```typescript
if (source.type === 'XTREAM') {
  streamUrl = buildXtreamStreamUrl(...)
} else {
  // M3U: providerItemId stores the direct stream URL
  streamUrl = buildM3UStreamUrl(selected.providerItemId)   // ← branch else attrape aussi PLEX
}
```

Le schéma DB définit 3 types : `XTREAM | M3U | PLEX`. Si une source PLEX existe avec des availabilities, elle passera la validation (`status === 'AVAILABLE'`, `enabled === true`) puis entrera dans la branch `else`. `providerItemId` d'une source PLEX n'est pas une URL de stream directe ; l'erreur sera opaque côté client plutôt qu'un message clair.

PLEX est out-of-scope pour ce ticket, mais une guard explicite préserve la lisibilité et évite une confusion future :

```typescript
if (source.type === 'XTREAM') {
  streamUrl = buildXtreamStreamUrl(...)
} else if (source.type === 'M3U') {
  streamUrl = buildM3UStreamUrl(selected.providerItemId)
} else {
  throw new ValidationError('Variant not available')
}
```

---

#### 🔵 Observation — Test mock sensible à l'ordre des appels DB

**Fichier** : `apps/api/src/services/__tests__/playback-resolver.test.ts`, lignes 52–65

Le mock de `db` utilise une queue (`dbResultQueue`) qui dépend de l'ordre exact des appels `select().from().where()`. Si l'ordre des requêtes dans `resolvePlayback` change, tous les tests échouent silencieusement avec des données incorrectes plutôt que de lever des erreurs explicites. Ce n'est pas bloquant aujourd'hui mais c'est à surveiller.

---

### Risques éventuels

- **Accumulation de connexions réseau** : sans `hls.destroy()`, chaque changement de variante ou navigation crée une connection HLS orpheline jusqu'au garbage collector. Sur une session longue avec plusieurs changements de variante, cela peut impacter les performances navigateur.
- **Régression `sourceMap.get(selected.providerId)!`** (ligne 126) : assertion non-null supposant que `selected` est toujours dans `candidates`. Ceci est garanti par la logique du code, mais toute modification future qui dissocierait `candidates` de `sourceMap` casserait ce point silencieusement.

---

### Décision

L'implémentation est fonctionnellement solide sur le backend et la gestion des credentials est correcte. Le problème bloquant est localisé et sa correction est précise : il ne remet pas en cause l'architecture ni les autres fichiers.

IMPLEMENTATION_FIX_REQUIRED
