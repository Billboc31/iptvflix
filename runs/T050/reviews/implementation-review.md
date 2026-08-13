I have all the information needed. Let me write the review.

---

# PR Review — T050: Secure Web Playback Flow from Selected Availability

## Résumé

L'implémentation couvre l'ensemble du périmètre du ticket : endpoint de résolution backend, isolation des credentials, player web avec HLS, reprise de position, sélection de variante, sync progress, et tests unitaires backend. Le code est propre, sécurisé et respecte le plan.

---

## Vérifications effectuées

- Lecture des fichiers implémentés : `playback-resolver.ts`, `routes/playback.ts`, `packages/api-contracts/src/playback.ts`, `providers/xtream/playback.ts`, `providers/m3u/playback.ts`, `PlayerPage.tsx`, `usePlayback.ts`, `useProgressSync.ts`, `App.tsx`, `index.ts`
- Lecture du plan `runs/T050/plan.md`
- Relecture complète du test suite `playback-resolver.test.ts`
- Vérification de l'enregistrement des routes protégées
- Vérification de l'isolation de `streamUrl` dans les DTOs
- Vérification des chemins d'erreur et de la redaction des credentials

---

## Points validés

**Sécurité / isolation des credentials**
- `streamUrl` est absent de tous les DTOs catalogues. Il n'apparaît que dans `PlaybackSessionResponse`, type réservé à l'endpoint de résolution. Ticket satisfait.
- `buildXtreamStreamUrl` ne logue pas l'URL construite. Aucun appel à `console.*` dans `playback-resolver.ts`. La vérification par spy `console.log`/`console.error` dans le test de secret redaction est correcte pour un module service (pas de logger Fastify/Pino injecté).
- Les messages d'erreur HTTP sont systématiquement génériques : `{ error: 'Variant not available' }`. Aucune fuite d'internals provider.
- L'endpoint est enregistré dans le scope protégé JWT (`index.ts:92`), au même niveau que `watchlistRoutes` et `viewingProgressRoutes`.

**Revalidation serveur**
- `resolvePlayback` revalide explicitement : existence dans `allRows` pour ce `mediaId`, `status === 'AVAILABLE'`, source `enabled === true`. Un `availabilityId` d'un autre media sera rejeté (not found dans `allRows` filtré par `mediaId`). Critère "Disabled, stale or unavailable variants are rejected server-side" satisfait.
- Le chemin `explicitAvailabilityId` propage correctement les erreurs typées : `NotFoundError → 404`, `ValidationError → 400`, `ForbiddenError → 403`.

**Sélection préférée**
- La branche `else` délègue à `resolveVariant()` (availability-resolver existant) avec les préférences du profil. Réutilisation correcte du resolver existant.
- Cas no-variant disponible : `resolveVariant` retourne `null`, le service lève `ValidationError`. Couvert par test.

**Résumé de position**
- `fetchProgress` lit `viewingProgress.progressSeconds`, défaut à 0. `setCurrentTime` sur `loadedmetadata`. Couvert par 2 tests.

**Player Web**
- HLS détecté par extension `.m3u8`. Import dynamique avec flag `cancelled` pour éviter le race condition sur unmount. `hlsInstance?.destroy()` au cleanup. Correct.
- Fallback native HLS (Safari) géré avec `video.canPlayType('application/vnd.apple.mpegurl')`.
- Variant selector visible si `alternatives.length > 0`. `switchVariant` re-resolve sans reload page.
- État loading/error correctement rendu.
- Route `/player/:mediaType/:mediaId` dans scope `ProtectedRoute` sans `AppShell`. Correct.

**Progress sync**
- Debounce 10 s via `lastSentRef`. Event `ended` envoie la position finale. Cleanup `removeEventListener` présent dans le return de l'effect. Correct.
- Erreurs `upsertProgress` silencieusement absorbées pour ne pas interrompre la lecture.

**Tests backend**
- 17 cas couvrant : sélection préférée (1 variant, choix qualité max), explicit valide/invalide (4 cas), resume position (2 cas), M3U, secret redaction, no variant available (2 cas), URL builders (4 cas).
- Mock DB par queue correctement ordonné. Gestion de `inArray` avec empty-guard (`providerIds.length > 0`) dans le service.

---

## Problèmes détectés

### Mineur — Assertions non-nulles non défensives (lignes 125–126, playback-resolver.ts)

```typescript
const selected = candidates.find((r) => r.id === selectedId)!
const source = sourceMap.get(selected.providerId)!
```

Les assertions `!` sont **logiquement sûres** dans le flow actuel (l'availability explicite est validée avant d'être cherchée dans `candidates`, donc elle y est forcément). Mais une future modification du flux de validation pourrait silencieusement introduire un panic runtime. Observation de robustesse, non bloquant.

### Mineur — `availabilityId` dans le body non validé comme UUID

Le route valide `mediaId` avec `UUID_RE` mais ne valide pas le format de `request.body.availabilityId` avant de le passer au resolver. Une valeur arbitraire (`"foo"`) sera simplement introuvable dans `allRows` et retournera un `NotFoundError → 404`. Comportement sûr mais génère un accès DB inutile. Non bloquant.

### Mineur — Aucun test pour source type non supporté (ex. PLEX)

Le code couvre correctement le cas :
```typescript
} else {
  throw new ValidationError('Variant not available')
}
```

Mais il n'y a pas de test vérifiant qu'une source de type `PLEX` lève bien `ValidationError`. Gap mineur de couverture.

### Observation — `mediaType` in PlayerPage défault silencieux

```typescript
const resolvedMediaType = mediaType === 'movie' ? 'movie' : 'episode'
```

Une valeur de param non prévue (ex. `undefined` si navigation cassée) est silencieusement traitée comme `'episode'`. En pratique seuls les boutons de l'app génèrent cette navigation avec des valeurs valides. Non bloquant.

### Observation — Plan mentionne `SeriesDetailPage.tsx`

Le plan dit d'ajouter les boutons Episode play dans `SeriesDetailPage.tsx`. L'implémentation les place dans `EpisodeRow.tsx`. Choix correct (meilleure encapsulation), mais c'est une déviation du plan. Pas un problème fonctionnel.

---

## Risques éventuels

- **Aucun risque de sécurité bloquant** : credentials isolés, endpoint protégé JWT, messages d'erreur génériques.
- Si `resolveVariant` est modifié pour retourner un `selectedVariantId` présent dans `allRows` mais absent de `candidates` (variants filtrés), les assertions `!` aux lignes 125–126 causeraient un crash runtime. À surveiller si la logique de `availability-resolver` évolue.
- La différenciation `404/400/403` selon le type d'erreur sur l'explicit ID révèle l'existence d'un availability ID. Acceptable (cohérent avec les pratiques REST et le message body générique), mais à noter si une posture d'énumération plus stricte est souhaitée.

---

## Décision

- **APPROVED**

L'implémentation respecte le ticket, le plan et les critères d'acceptance. La sécurité des credentials est correctement assurée. Les tests backend couvrent les chemins critiques. Les observations relevées sont des améliorations de robustesse, non des blockers.

---

IMPLEMENTATION_APPROVED
