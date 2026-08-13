# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T057/reviews/implementation-review.md
- generated at: 2026-08-13T03:06:40Z

---

# PR Review — T057

## Résumé

L'implémentation couvre bien le scope : hooks `useDevices`/`usePlayOnTv`, composant `DevicePickerModal` (avec fast-path), `DeviceListItem`, `DeviceSettingsPage`, intégration dans les pages Movie/Series/EpisodeRow, route, navigation, et 3 fichiers de test. La structure est propre, les erreurs sont gérées explicitement.

**Un problème bloquant empêche la validation.**

---

## Problème bloquant — AC #5 : Resume/depuis le début inatteignable en production

Le toggle "Reprendre / Depuis le début" dans `DevicePickerModal` n'apparaît que quand `progressMs > 0`. Or **ni `MovieDetailPage` ni `EpisodeRow` ne passent jamais `progressMs`** au modal — la prop vaut toujours `0` (défaut).

**Cause racine** : `MovieDetailResponse` et `EpisodeResponse` ne contiennent pas la position de progression en millisecondes. `EpisodeResponse` expose seulement `watchState: 'in_progress' | 'watched' | ...` sans valeur numérique. Aucune requête complémentaire n'est faite.

**Conséquence** : le toggle n'est jamais affiché, `startPositionMs` n'est jamais envoyé. La fonctionnalité de reprise est du dead code en production, alors que le ticket l'exige explicitement (AC #5 : "Resume/from-start selection is preserved in the command").

Le test `shows resume toggle when progressMs > 0` passe uniquement parce qu'il injecte `progressMs={60000}` manuellement — il ne valide pas d'intégration réelle.

**Correction requise** : câbler la position réelle — soit en étendant les types `MovieDetailResponse`/`EpisodeResponse` avec `progressMs?: number` et en l'alimentant côté backend, soit en interrogeant l'endpoint user-state depuis les pages de détail et en passant la valeur au modal.

---

## Points mineurs

- **Plan §8** : le plan spécifie d'ajouter le lien "Appareils" dans `ProfileSettingsPage.tsx` ; l'implémentation l'a mis dans `LeftNav` seulement. Suggéré : ajouter le lien dans `ProfileSettingsPage` aussi.
- **Icône doublon** : 📺 utilisé à la fois pour "Séries" et "Appareils TV" dans `LeftNav`.
- **EpisodeRow** : aucun test ne couvre le bouton 📺 TV au niveau du composant `EpisodeRow`.

---

## Décision

**REQUEST_CHANGES** — le problème bloquant doit être résolu avant approbation.

La review est sauvegardée dans `runs/T057/reviews/review-T057.md`.

IMPLEMENTATION_FIX_REQUIRED
