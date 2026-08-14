All 46 T078-specific tests pass. The broad test-suite failures are pre-existing `document is not defined` environment issues unrelated to this ticket.

Now I have enough to write the full review.

---

# PR Review — T078: Make web playback actually play resolved Xtream streams end-to-end

## Résumé

L'implémentation délivre l'architecture principale demandée : session store TTL côté serveur, gateway de streaming avec pass-through mp4 (Range-aware) et remux ffmpeg pour ts/mkv → fmp4, interface player custom complète, et persistance de la progression. Les 46 tests unitaires du ticket passent.

Deux problèmes bloquants subsistent : un bug de détection HLS dans `PlayerPage` qui rend hls.js inaccessible, et l'absence du test e2e requis par le plan.

---

## Vérifications effectuées

- Session store (`playback-session-store.ts`) — TTL, pruning, UUID, credentials restent côté serveur
- Resolver (`playback-resolver.ts`) — création de session, retour de `gatewayUrl`, logs sans credentials
- Gateway (`routes/playback.ts`) — mp4 pass-through, HLS pass-through, remux ts/mkv, mapping d'erreurs upstream
- Contrat API (`packages/api-contracts/src/playback.ts`) — `streamUrl` → `gatewayUrl`, propre
- `PlayerPage.tsx` — chargement de la source, gestion des erreurs, reprise de position, contrôles custom
- `PlayerControls.tsx` — play/pause, seek, volume/mute, fullscreen, affichage temps, dropdown variantes, auto-hide
- `useProgressSync.ts` — debounce timeupdate, envoi immédiat à pause, completion à `ended`, envoi au unmount
- `usePlayback.ts` — résolution, switchVariant, gestion d'erreurs
- Points d'entrée : HeroSection (films), MovieDetailPage, EpisodeCard, SeriesDetailPage
- Tests : 46/46 pass pour `playback-gateway`, `playback-session-store`, `playback-resolver`

---

## Points validés

- **Credentials jamais exposés** au browser : `providerStreamUrl` reste dans le session store ; `gatewayUrl` est la seule URL retournée au client. Les logs de resolve ne contiennent ni `username` ni `password`.
- **Gateway mp4 Range-aware** : en-tête `Range` forwardée upstream, `Accept-Ranges: bytes`, `Content-Range` retournée. Le seek fonctionnera pour VOD mp4.
- **Remux ts/mkv → fmp4** : ffmpeg avec `frag_keyframe+empty_moov+default_base_moof`. Stratégie correcte : attendre le premier chunk avant de commiter la réponse (→ 415 propre si ffmpeg absent).
- **HLS pass-through** fonctionnel côté gateway (manifest servi, `Content-Type` correct).
- **Mapping d'erreurs** upstream → HTTP : 401/403/404/504/415. Messages localisés en français.
- **Déconnexion client** : `request.raw.on('close', abort)` pour upstream fetch + `ffmpeg.kill('SIGKILL')`. Propre.
- **PlayerControls** : tous les contrôles requis présents. Seek désactivé si `duration` non fini (live). Indicateur buffering. Auto-hide 3s.
- **useProgressSync** : `timeupdate` debounced 10s, `pause` immédiat, `ended` envoie durée complète, unmount envoie position courante.
- **EpisodeCard** : navigue vers `/player/episode/:id?availabilityId=...`. ✅
- **MovieDetailPage** : `playRoute = /player/movie/:id?availabilityId=...`. ✅
- **SeriesDetailPage** : pas de bouton "Regarder" niveau série (pas de mediaType episode au niveau série) — comportement intentionnel, lecture via EpisodeCard. ✅

---

## Problèmes détectés

### 🔴 Bloquant 1 — HLS dead code : `gatewayUrl.includes('.m3u8')` sera toujours `false`

**Fichier** : `apps/web/src/pages/PlayerPage.tsx:53`

```ts
if (gatewayUrl.includes('.m3u8') || gatewayUrl.includes('.m3u')) {
```

`gatewayUrl` est toujours de la forme `/api/playback/stream/{uuid}` — jamais `.m3u8`. La branche hls.js ne s'active jamais. Pour mp4/fmp4 remuxé, le fallback `video.src = gatewayUrl` fonctionne. Pour les streams HLS, le navigateur reçoit le manifest via `<video src>` : Safari jouera nativement, Chrome pas.

**Correction attendue** : détecter le format HLS depuis le contrat résolu, soit en ajoutant un champ `containerType` à `PlaybackSessionResponse`, soit via le `Content-Type` d'une HEAD request préalable, soit en s'appuyant sur `containerExtension` retournée dans le contexte de session (exposer ce champ en lecture seule dans la réponse `/resolve`).

---

### 🔴 Bloquant 2 — HLS : segments non proxifiés

**Fichier** : `apps/api/src/routes/playback.ts:129-131`

```ts
const body = await upstreamRes.text()
return reply.status(upstreamRes.status).send(body)
```

Le manifest HLS est retransmis tel quel. Si le manifest contient des URLs absolues vers le provider (cas Xtream classique), le browser fetchera les segments directement depuis le provider : credentials exposés, CORS, mixed-content.

Le plan exigeait une réécriture des segment URLs ou une sous-route `/playback/stream/:sessionId/segment`. Ce n'est pas implémenté.

**Impact** : HLS depuis un provider Xtream HTTP échouera systématiquement depuis une origin HTTPS, ou exposera les credentials. Cette lacune est cohérente avec le bug précédent (hls.js jamais activé) mais les deux doivent être résolus ensemble.

---

### 🟡 Significatif — Test e2e absent

**Fichier manquant** : `e2e/tests/playback.spec.ts`

Le plan liste ce test dans les critères d'acceptation. Il n'est pas créé. La liste des fichiers e2e ne contient que des specs préexistants non liés au ticket. L'intégration end-to-end (fake Xtream server → sync → click play → vidéo joue) n'est pas couverte.

---

### 🟡 Mineur — `Transfer-Encoding: chunked` explicite dans le remux path

**Fichier** : `apps/api/src/routes/playback.ts:205`

```ts
reply.header('Transfer-Encoding', 'chunked')
```

En HTTP/2, ce header est interdit (RFC 9113 §8.2.2). Fastify le strippera probablement, mais c'est une déclaration inutile qui peut causer des warnings avec certains proxies/loadbalancers. Le streaming fmp4 est déjà chunked implicitement via le PassThrough. Supprimer ce header.

---

### 🟡 Mineur — Secret redaction test n'intercepte pas `console.info`

**Fichier** : `apps/api/src/services/__tests__/playback-resolver.test.ts:458-463`

Le test mock `console.log` et `console.error` mais pas `console.info`. Or, le resolver appelle `console.info('playback-resolver: session created', {...})`. Les données loggées (sessionId, mediaType, etc.) ne contiennent pas de credentials — donc pas de fuite en pratique — mais si quelqu'un ajoute un `console.info` avec des credentials, ce test ne le détecterait pas. Ajouter un spy sur `console.info`.

---

## Risques éventuels

- **ffmpeg non installé en prod** : la gateway retourne 415 gracieusement — c'est documenté et le comportement est acceptable. Pas de risque silencieux.
- **In-memory session store** : redémarrage API = sessions perdues. Acceptable pour un système single-profile, mais tout player ouvert au moment d'un redémarrage donnera 404 sur le stream. Hors scope T078 (plan l'a explicitement exclu).
- **HLS segments proxifying** : même après correction du bug de détection, le segment proxy sous-route devra être ajouté avant que HLS soit opérationnel.

---

## Décision

L'architecture gateway est solide et correctement testée pour les formats primaires (mp4 pass-through, ts/mkv remux). Le core path Xtream VOD → session → gateway → browser est fonctionnel pour les formats les plus courants.

Cependant, deux issues bloquantes empêchent l'approbation :

1. Le bug de détection HLS dans `PlayerPage` est silencieux (pas d'erreur visible, juste hls.js jamais utilisé) mais cassera la lecture HLS sur Chrome.
2. Le test e2e est explicitement requis par le plan et absent.

## Actions demandées

1. Corriger la détection HLS dans `PlayerPage` — exposer `containerExtension` (ou un booléen `isHls`) dans la réponse `/resolve` et initialiser hls.js sur cette base plutôt que sur le contenu de la gatewayUrl.
2. Implémenter la réécriture des segment URLs dans la gateway HLS, ou documenter explicitement que HLS est hors scope de ce ticket (en alignant le plan et le code).
3. Créer `e2e/tests/playback.spec.ts` avec le fixture fake Xtream server pour le smoke test end-to-end (au minimum la détection que la vidéo démarre).
4. Supprimer `reply.header('Transfer-Encoding', 'chunked')` dans le remux path.
5. (Optionnel) Ajouter `vi.spyOn(console, 'info')` dans le test de secret redaction.

IMPLEMENTATION_FIX_REQUIRED
