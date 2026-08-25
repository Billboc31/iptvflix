---

# PR Review — T132: Live TV Dashboard UI (Review 2 — post-fix)

## Résumé

L'implémentation avait un problème bloquant identifié lors de la review 1 : `recordHistory` n'était jamais appelé lors d'une lecture. Le fix a correctement résolu ce problème pour les deux pages principales (`HomePage` via `LiveRail`, `AllChannelsPage` via `ChannelRow`). Deux nouveaux tests valident les comportements ajoutés. Le reste de l'implémentation reste solide.

---

## Vérifications effectuées

- Lecture des fichiers modifiés par le fix : `LiveRail.tsx`, `ChannelRow.tsx`, `HomePage.tsx`, `AllChannelsPage.tsx`
- Vérification des deux nouveaux tests dans `LiveRail.test.tsx` et `AllChannelsPage.test.tsx`
- Vérification du contexte `ChannelsContext.tsx` (logique `recordHistory`)
- Vérification de `ChannelCard.tsx` (fallback `onPlay`)
- Vérification des pages secondaires : `FavoritesPage.tsx`, `RecentPage.tsx`
- Vérification de `Sidebar.tsx`, `EpgProgress.tsx`

---

## Fix validé

**Problème bloquant de la review 1 : corrigé.**

- `LiveRail.tsx` : nouveau prop `onRecordHistory?: (channelId: string) => void`, passé à `ChannelCard.onPlay` via `(url) => { onRecordHistory(ch.id); window.open(url, ...) }`. Lorsque `onRecordHistory` est absent, `onPlay` reste `undefined` et `ChannelCard` fait le `window.open` lui-même — fallback propre.
- `ChannelRow.tsx` : nouveau prop `onRecordHistory?: () => void`, appelé après résolution du stream URL. Optionnel, sans régression.
- `HomePage.tsx` : passe `recordHistory` depuis le contexte aux deux `<LiveRail>` (rail principal et rail récent).
- `AllChannelsPage.tsx` : passe `() => recordHistory(channel.id)` à chaque `<ChannelRow>`.
- Tests `LiveRail.test.tsx` (`calls onRecordHistory when a card is played`) et `AllChannelsPage.test.tsx` (`calls recordHistory when a channel play button is clicked`) : corrects, couvrent les deux surfaces ajoutées.

---

## Observations post-fix

### 🟡 MINEUR — `recordHistory` non câblé dans `FavoritesPage` et `RecentPage`

`FavoritesPage.tsx` et `RecentPage.tsx` utilisent `<ChannelRow>` sans passer `onRecordHistory`. Un play depuis ces pages ne met pas à jour l'historique. Le prop étant optionnel, pas de crash, mais l'historique est incomplet si l'utilisateur joue depuis ces pages.

Non bloquant : les deux pages primaires sont correctement câblées, et la prop a été rendue optionnelle précisément pour ce type d'usage progressif. À noter pour un suivi.

### 🟡 MINEUR — Non-null assertions dans `RecentPage.tsx`

```ts
const recentChannels = history
  .map((h) => byId.get(h.channelId))
  .filter((c) => c !== undefined)  // sans type predicate
```

Sans le type predicate `(c): c is ChannelResponse`, TypeScript infère `(ChannelResponse | undefined)[]`, forçant l'usage de `channel!.id` plus bas. `HomePage.tsx` utilise le pattern correct avec prédicat. Fonctionnel, mais style incohérent. Non bloquant.

### Mineurs persistants de la review 1 (inchangés)

- `EpgProgress` : calcul statique (une seule fois au render), pas de rafraîchissement en temps réel. Acceptable pour ce livrable.
- Bouton favori dans `ChannelCard` : `opacity-0 group-hover:opacity-100`, invisible sur touch. Favoris restent accessibles via `ChannelRow`.
- Filtre HD/4K : non implémenté, ticket le qualifie avec "where reliable", modèle de données ne l'expose pas. Acceptable.

---

## Décision

Le problème bloquant est résolu. Les mineurs restants sont des pistes d'amélioration, pas des obstacles à la livraison. L'implémentation satisfait les critères d'acceptance du ticket.

IMPLEMENTATION_APPROVED
