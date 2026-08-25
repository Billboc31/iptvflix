I have a complete picture of the implementation. Let me write the review.

---

# PR Review — T131: Canonicalize and deduplicate Live TV channels

## Résumé

Deuxième review après un premier cycle de fix. Les deux issues bloquantes détectées lors de la première review ont été correctement corrigées. L'implémentation couvre l'intégralité des critères d'acceptance du ticket : schéma DB, pipeline de déduplication par confiance, normalisation générique, sélection de source, routes API, tests unitaires (17) et E2E. L'architecture est cohérente avec le reste du codebase.

## Vérifications effectuées

- **Fix #1** — `channel-normalizer.ts:29` : `replace(/_/g, ' ')` (underscores uniquement). Vérifié dans le fichier : correction appliquée. `normalizeChannelName('M.6')` → `'m.6'` ✓
- **Fix #2** — `channel-normalizer.test.ts:54` : assertion corrigée en `'bfm tv'` (un espace). Vérifié dans le fichier ✓
- Schema DB `channels.ts` + `channel-sources.ts` + migration `0053_t131_live_tv_channels.sql`
- Algorithme de déduplication `channel-sync-service.ts` — logique de confiance et index en mémoire
- Module normalisation + catégories + sélecteur de source
- Routes `GET /channels` et `GET /channels/:id/stream` + contrats API
- Classification M3U `'live'` (parser) + peuplement `liveChannels` (client)
- Intégration Xtream : `getLiveCategories()`, `getLiveStreams()`, `syncLiveChannels()` dans `catalog-sync-service.ts`
- Suite de tests unitaires (17 cas)
- Fixture E2E : playlist 5 entrées → 3 canaux canoniques

## Points validés

- **Fixes bloquants appliqués** — les deux corrections de la review précédente sont présentes et correctes dans le code.
- **Schéma DB** : `UNIQUE(source_id, provider_item_id)` garantit l'idempotence au niveau DB. `match_confidence` et `match_provenance` NOT NULL. FK CASCADE sur les deux tables.
- **Déduplication** : `TF1 + TF1 HD + TF1 FHD` partagent le même `tvgId` → confidence 1.0 → merged en 1 canal. `Arte + Arte HD` sans tvgId → confidence 0.4 < seuil 0.75 → 2 canaux séparés (comportement conservateur correct).
- **Non-merge ambiguïté** : deux entrées avec le même nom normalisé mais des `tvgId` distincts → tvgId mismatch → confidence 0.4 < 0.75 → canaux séparés ✓
- **Multi-provider** : même `tvgId` depuis deux sources → 1 canal, 2 `channel_sources` ✓
- **Logo** : null → non-null sur second sync → `channels.logoUrl` mis à jour ; création avec logo → `channels.logoUrl` peuplé immédiatement ✓
- **Lifecycle** : sources absentes du snapshot → `status = UNAVAILABLE`, `unavailableAt` renseigné ✓
- **Idempotence** : second sync identique → 0 nouveaux canaux, 0 nouvelles sources ✓
- **Sélecteur de source** : pur, sans effet de bord ; tri AVAILABLE → priority desc → lastSeenAt desc ✓
- **Routes** : `GET /channels` filtre sur au moins une source AVAILABLE, ordonnée par `canonicalName`. `GET /channels/:id/stream` délègue à `selectPreferredSources` ✓
- **Xtream intégration** : `getLiveCategories` et `getLiveStreams` en parallèle avec dégradation gracieuse sur erreur (catch → []) ; `providerItemId = String(s.stream_id)` stable ✓
- **M3U intégration** : classification `'live'` pour entrées avec group-title non-VOD/series ; `liveChannels` correctement peuplé ✓
- **Pas de hardcoding** de noms de chaînes dans le code de production ✓
- **Migration** Drizzle uniquement, pas d'édition DB manuelle ✓
- **Fixture E2E** : 5 entrées (3 TF1 avec même tvg-id + France 2 + France 3) → 3 canaux canoniques. Aligné avec les assertions ✓
- **Contrats API** : `ChannelResponse` avec `categories: string[]`, `ChannelStreamResponse` avec `streamUrl` ✓

## Problèmes détectés

Aucun problème bloquant. Les trois observations mineures de la première review subsistent mais restent non-bloquantes :

1. **`sourcesCreated` légèrement inexact** (`channel-sync-service.ts:176`) — `onConflictDoNothing` peut passer silencieusement sans être détecté par `existingSourcesByItemId`, incrémentant quand même le compteur. Impact : diagnostic uniquement.

2. **M3U `providerItemId = entry.streamUrl`** (`catalog-sync-service.ts:1469`) — pas de fallback vers `entry.tvgId`, contrairement aux films/séries M3U (`entry.tvgId ?? entry.streamUrl`). Si un provider change ses URLs entre syncs, des sources stales s'accumulent. La fixture E2E utilise des URLs stables, le comportement dans ce contexte est correct.

3. **404 body trompeur** (`routes/channels.ts:65`) — `GET /channels/:id/stream` retourne `{ streamUrl: '' }` avec status 404, ce qui est techniquement du type `ChannelStreamResponse` alors que c'est une erreur. Mineure, à corriger dans un follow-up si le frontend en souffre.

## Risques éventuels

- **Xtream `direct_source ?? ''`** (`catalog-sync-service.ts:1292`) — Si l'API Xtream ne fournit pas `direct_source` pour un live stream, la `streamUrl` sera vide string. La construction de l'URL de lecture Xtream live (format `host/user/pass/stream_id`) est hors scope de ce ticket ; ce cas n'affecte que des providers Xtream sans `direct_source`.
- **Full table scan `channels`** — acceptable aux volumes actuels, à monitorer au-delà de ~50k canaux.

## Décision

Les deux corrections bloquantes sont correctement appliquées et vérifiées dans le code. Les 17 tests unitaires passent selon l'output du coder. L'implémentation respecte le plan, couvre tous les critères d'acceptance et n'introduit pas de scope additionnel. Les observations mineures résiduelles n'affectent pas la correction fonctionnelle.

IMPLEMENTATION_APPROVED
