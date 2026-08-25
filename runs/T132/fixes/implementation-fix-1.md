# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T132/reviews/implementation-review.md
- generated at: 2026-08-25T09:47:13Z

---

I have enough information to write the complete review. Let me compile it now.

---

# PR Review — T132: Live TV Dashboard UI

## Résumé

L'implémentation couvre de manière solide le périmètre du ticket : shell avec TopBar + Sidebar, rail "En direct maintenant", rail "Récemment regardées", raccourcis catégories, page "Toutes les chaînes" avec recherche/filtres, favoris persistés côté API, contrats EPG-ready, et cinq suites de tests unitaires. Le code est lisible, les composants bien découpés, la sécurité respecte le modèle auth/profile de l'API existante.

Un problème fonctionnel bloquant a été identifié : l'enregistrement de l'historique n'est pas déclenché lors de la lecture d'une chaîne.

---

## Vérifications effectuées

- Lecture de tous les composants frontend clés (ChannelCard, ChannelRow, LiveRail, HomePage, AllChannelsPage, Sidebar, TopBar, EpgProgress, CategoryShortcuts)
- Lecture du contexte partagé (ChannelsContext, lib/api.ts)
- Lecture des routes API (channels, channel-favorites, channel-history)
- Vérification de la migration SQL et des foreign keys
- Vérification du modèle d'auth (protectedScope vs profileScope)
- Lecture des cinq fichiers de tests unitaires
- Vérification des fichiers VOD non touchés au niveau source

---

## Points validés

**Architecture et sécurité**
- `channelFavoritesRoutes` et `channelHistoryRoutes` sont bien dans `profileScope` (requireProfile middleware) — les données sont correctement scopées par profil.
- `channelsRoutes` dans `protectedScope` — la route publique `/channels` gère le cas `profileId = null` proprement.
- Migration `0054` : foreign keys avec `ON DELETE CASCADE` sur `profiles` et `channels` — pas de données orphelines.
- `addFavorite` utilise `onConflictDoNothing` — idempotent, pas d'erreur si double-ajout.
- Pas de secret exposé, pas de log de données sensibles.

**Conformité ticket**
- Top shell : branding IPTVFlix, switch VOD/TV (TV actif en orange), recherche, affichage profil — ✓
- Sidebar : 5 items de navigation + catégories dynamiques depuis l'API — ✓ (pas de catégories hardcodées)
- Rail "En direct maintenant" : logo, badge LIVE, EPG si disponible, progress bar, play — ✓
- États EPG présent / EPG absent : les deux paths rendent proprement — ✓
- "Récemment regardées" : rail omis si history vide, affiché si présent — ✓ (logique côté rendu)
- Catégories en raccourcis avec comptage dynamique — ✓
- "Toutes les chaînes" : search + filtre favoris + filtre catégorie — ✓
- Favoris : canonical channel-based, persistés via API, optimistic update avec rollback — ✓
- Pas de doublons ChannelSource en affichage (seul le canonical channel est exposé) — ✓
- Contrats EPG (`EpgProgram.now`, `.next`, `startTime`, `endTime`) définis dans `api-contracts` — ✓
- Pas de fausses données EPG en production — ✓
- VOD source inchangé (seuls des artefacts compilés et `.env.example` modifiés) — ✓
- Tests unitaires : ChannelCard, AllChannelsPage, ChannelsContext, EpgProgress, LiveRail — ✓

**Qualité code**
- Composants courts, nommage explicite, séparation des responsabilités.
- `EpgProgress` : calcul borné à [0, 100], guard sur `end <= start`, attributs ARIA `progressbar`.
- `ChannelCard` et `ChannelRow` : erreurs réseau distinctes (404 vs autre), spinner pendant le chargement.
- `ChannelsContext` : fire-and-forget pour history (`void`), pas de blocage UI.

---

## Problèmes détectés

### 🔴 BLOQUANT — Histoire non enregistrée lors de la lecture

**Fichiers concernés** : `ChannelCard.tsx`, `LiveRail.tsx`, `ChannelRow.tsx`, `ChannelsContext.tsx`

`recordHistory` est défini dans `ChannelsContext` et les routes API (`POST /channels/:id/history`) existent. Cependant, `recordHistory` n'est jamais appelé quand l'utilisateur clique sur "Regarder".

- `ChannelCard` expose un prop `onPlay?: (streamUrl: string) => void` qui permettrait d'injecter `recordHistory`, mais `LiveRail` ne le passe pas.
- `ChannelRow` n'a pas de prop `onPlay` du tout.
- `AllChannelsPage` ne passe pas non plus de callback play.

**Conséquence** : le rail "Récemment regardées" n'affichera que l'historique pré-existant chargé au démarrage. Les nouvelles lectures ne sont jamais enregistrées. Le critère "If the underlying persistence already exists, wire it" n'est pas satisfait alors que la persistance existe.

**Correction attendue** : passer `onPlay` depuis `LiveRail` vers `ChannelCard`, et depuis `ChannelRow` vers son handler interne, en appelant `recordHistory(channel.id)` après l'ouverture du stream.

Exemple minimal pour `LiveRail.tsx` :
```tsx
// passer onPlay qui appelle recordHistory puis ouvre le stream
onPlay={(url) => { onRecordHistory?.(ch.id); window.open(url, '_blank', 'noopener') }}
```

### 🟡 MINEUR — EpgProgress statique (pas de rafraîchissement)

`EpgProgress` calcule le pourcentage une seule fois lors du render (via `Date.now()`). Le progrès n'évolue pas en temps réel si l'utilisateur reste sur la page. Acceptable pour un premier livrable, mais à noter pour une amélioration future (setInterval ou requestAnimationFrame).

### 🟡 MINEUR — Bouton favoris inaccessible au toucher sur le rail

Dans `ChannelCard`, le bouton favori utilise `opacity-0 group-hover:opacity-100`. Sur mobile/touch, sans hover, le bouton est invisible. Les favoris restent accessibles via `ChannelRow` dans "Toutes les chaînes" (le bouton reste visible pour les chaînes déjà favorites), mais pas depuis le rail principal sur mobile.

### 🟡 MINEUR — Filtre HD/4K non implémenté

Le ticket mentionne "filtres HD/4K où fiable". Pas implémenté — le ticket qualifie cela avec "where reliable" ce qui laisse une latitude, et le modèle de données canonique ne semble pas exposer d'indicateur HD. À confirmer si intentionnellement différé.

---

## Risques éventuels

- **Token dans l'URL pour le switch VOD/TV** : `handleVodSwitch` place le JWT en query param (`?token=...`). C'est un pattern existant (T130/T131), pas nouveau dans ce ticket. Le token est supprimé de l'URL immédiatement via `history.replaceState`. Risque résiduel faible (browser history), pattern à documenter mais non bloquant ici.
- **`selectDistinctOn` PostgreSQL** : la route history utilise une syntaxe PG-spécifique. Sans risque dans ce projet qui est PostgreSQL-only, mais à noter.

---

## Décision

L'implémentation est globalement solide et couvre la grande majorité des critères d'acceptance. Un problème fonctionnel bloquant empêche l'approbation : l'historique de visionnage n'est pas enregistré lors de la lecture, alors que la persistence est en place et que `recordHistory` est défini dans le contexte.

IMPLEMENTATION_FIX_REQUIRED
