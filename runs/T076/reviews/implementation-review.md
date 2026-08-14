---

# PR Review — T076: Replace Home featured card with full-width cinematic hero

## Résumé

L'implémentation est **conforme au ticket et au plan**. 5 fichiers modifiés/créés couvrent l'intégralité du scope : nouveau hook `useFeaturedMedia`, refonte de `HeroSection`, intégration dans `HomePage`, et tests associés.

## Points validés

- **Sizing** : `h-[60vh] md:h-[85vh]` correctement implémenté, min-height sécurisé
- **Sélection featured** : priorité backdrop dynamique (movie > series, avec > sans), non hardcodée, popularité TMDB
- **Preview** : auto-démarrage 2 s, `prefers-reduced-motion` respecté, mute par défaut, cleanup propre via `isActiveRef`
- **Actions** : `▶ Lire` conditionnel sur disponibilité ET mediaType movie ; `Plus d'infos` délègue à `useOpenDetail` (#150) ; `+ Ma Liste` absent
- **Mobile** : poster portrait `object-top`, fallback backdrop, pas de débordement horizontal
- **Gradients** : top 32px (nav), gauche, bas h-2/3 — blend fluide avec `mt-2` sur les shelves
- **Accessibilité** : `role="region" aria-label="Contenu vedette"`, `focus-visible:ring-2`, aria-labels mute
- **Résilience** : shelves indépendants du hero, failure n'est pas bloquante
- **Tests** : 20 tests couvrant logique de sélection, timing, reduced-motion, mute, play conditionnel, cleanup

## Problèmes détectés (mineurs, non bloquants)

1. **Commentaire trompeur** — `HeroSection.tsx:77` : `"mounts only when active"` mais la condition est `trailerKey &&`, pas `isActive &&`. Ambiguïté sur le lazy-loading de l'iframe YouTube.
2. **Test manquant** — `Plus d'infos` button : le critère d'acceptation "`ⓘ Plus d'infos` always present and calls `openDetail`" n'est couvert par aucun test dans `HeroSection.test.tsx` (le code est correct, la couverture est absente).
3. **Test manquant** — rendu artwork mobile : la logique `posterUrl → backdropUrl → gradient` n'est pas testée.

## Décision

```
IMPLEMENTATION_APPROVED
```
