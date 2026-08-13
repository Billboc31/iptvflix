# PR Review — T057: Add Web 'Play on TV' device picker and remote handoff UX

## Résumé

L'implémentation couvre l'essentiel du scope : hook `useDevices`, hook `usePlayOnTv`, composant `DevicePickerModal` avec fast-path, `DeviceListItem`, page `DeviceSettingsPage`, intégration dans `MovieDetailPage` / `SeriesDetailPage` / `EpisodeRow`, route `/settings/devices`, lien dans la navigation, 3 fichiers de test.

La structure du code est propre, les mutations sont bornées au ticket, la gestion d'erreurs est explicite, les messages utilisateur sont cohérents. Cependant un problème bloquant empêche la validation : la fonctionnalité Resume/depuis le début n'est jamais accessible à l'utilisateur en production.

---

## Vérifications effectuées

- Lecture du plan (`runs/T057/plan.md`) et du ticket
- Lecture de tous les fichiers créés et modifiés (hooks, composants, pages, tests, api.ts, App.tsx, LeftNav.tsx)
- Vérification des types dans `packages/api-contracts/src/catalog.ts` et `user-state.ts`
- Vérification du câblage de `progressMs` dans `MovieDetailPage` et `EpisodeRow`
- Lecture des tests `DevicePickerModal.test.tsx`, `useDevices.test.ts`, `DeviceSettingsPage.test.tsx`

---

## Points validés

- **AC #1** — Approbation de pairing via code 8 caractères : ✅ `DeviceSettingsPage` valide le code (`getPairingCodeDetail`), gère expired/approved/unknown, appelle `approvePairingCode`.
- **AC #2 / AC #3** — Affichage des appareils avec statut en ligne/hors ligne, désactivation des offline : ✅
- **AC #4** — Handoff épisode avec `mediaType: 'episode'` et `mediaId` correct : ✅ câblé dans `EpisodeRow`
- **AC #6** — Renommage et révocation depuis `DeviceSettingsPage` : ✅
- **AC #7** — Un seul appareil → fast-path immédiat avec toast nommant l'appareil : ✅
- **AC #8** — Offline/révoqué → état UI clair, pas de succès silencieux : ✅ `usePlayOnTv` pré-vérifie en ligne avant d'envoyer ; modal ne se ferme pas sur erreur
- **AC #9** — Lecture Web locale préservée, bouton "Play on TV" est additionnel : ✅
- **AC #10** — Tests : hooks, modal, page de gestion : ✅ couverture des cas nominaux et d'erreur
- **Qualité** — Code lisible, mutations optimistes cohérentes, gestion d'erreur explicite dans `DeviceSettingsPage` (3 cas distincts), `CommandState` bien typé
- **Sécurité** — Pas de secrets hardcodés, pas d'exécution directe browser-to-TV, utilisation du header d'authentification existant
- **Plan §1–§7** — Implémentés conformément au plan

---

## Problèmes détectés

### 🔴 BLOQUANT — AC #5 : Resume/depuis le début inatteignable en production

**Problème** : Le composant `DevicePickerModal` affiche le toggle Resume/depuis le début uniquement quand `progressMs > 0`. Or ni `MovieDetailPage` ni `EpisodeRow` ne passent de valeur `progressMs` au modal.

**Cause** : Les types `MovieDetailResponse` et `EpisodeResponse` ne contiennent pas la position de progression en millisecondes. `EpisodeResponse` expose seulement `watchState: 'unwatched' | 'in_progress' | 'watched' | null` (pas de position), et `MovieDetailResponse` n'a pas de champ de progression du tout. Aucune requête séparée n'est effectuée pour récupérer la position.

**Conséquence** : `progressMs` vaut toujours `0` (valeur par défaut du prop), le toggle n'apparaît jamais, `startPositionMs` n'est jamais envoyé. La fonctionnalité de reprise est du dead code en production.

**Le test de resume** (`shows resume toggle when progressMs > 0`) passe uniquement parce qu'il injecte manuellement `progressMs={60000}` — il ne teste pas d'intégration réelle.

**AC non couvert** : Ticket AC → "Resume/from-start selection is preserved in the command" ; Plan §4 → "Resume/from-start toggle shown when `progress.positionMs > 0`" ; Plan AC #5.

**Correction requise** : L'une des approches suivantes :

1. Ajouter `progressMs?: number` à `EpisodeResponse` (dans les contracts) et le renseigner côté backend depuis `user-state`, puis le passer dans `EpisodeRow → DevicePickerModal`. Même logique pour `MovieDetailResponse`.
2. Ou faire un appel séparé `GET /user-state/:mediaType/:mediaId` dans `MovieDetailPage` et `SeriesDetailPage` pour récupérer la position, puis la passer comme `progressMs` au modal.

---

### 🟡 MINEUR — Déviation plan §8 : lien navigation dans `LeftNav` et non `ProfileSettingsPage`

**Problème** : Le plan spécifie "Add "Devices" link in the Settings navigation section of `ProfileSettingsPage.tsx`." L'implémentation l'a ajouté dans `LeftNav.tsx` à la place.

**Analyse** : La navigation via `LeftNav` est accessible et logique. Mais `ProfileSettingsPage` n'a pas de lien vers `/settings/devices`, contrairement au plan. Si `ProfileSettingsPage` est la surface "Paramètres" principale, l'entrée devrait y figurer également.

**Correction suggérée** : Ajouter un lien "Appareils TV → /settings/devices" dans `ProfileSettingsPage.tsx`, en complément du lien LeftNav déjà présent.

---

### 🟡 MINEUR — Icône 📺 en doublon dans la navigation

`LeftNav` utilise 📺 pour "Séries" (ligne 13) ET pour "Appareils TV" (ligne 20). Préférer une icône distincte pour les appareils (ex. `📡`, `🖥`, `📻`).

---

### 🟡 MINEUR — Aucun test couvrant le bouton TV dans `EpisodeRow`

`EpisodeRow.test.tsx` a été modifié pour corriger le wrapper `MemoryRouter`/`ToastProvider`, mais aucun test ne vérifie le comportement du bouton "📺 TV" (affichage conditionnel, ouverture du modal). Ce n'est pas bloquant car `DevicePickerModal.test.tsx` couvre la logique, mais la couverture au niveau du composant `EpisodeRow` est absente pour cette fonctionnalité.

---

## Risques éventuels

- Sans fix du `progressMs`, tout utilisateur ayant de la progression sur un film/épisode ne pourra pas reprendre là où il en était via "Play on TV" — il devra relancer depuis le début systématiquement. Ce comportement silencieux est trompeur puisque le UI du modal (dans les tests) laisse croire que la fonctionnalité existe.

---

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES** — Le problème bloquant (AC #5 inatteignable) doit être résolu avant validation.

## Actions demandées

1. **[Bloquant]** Câbler `progressMs` dans `MovieDetailPage` et `EpisodeRow` :
   - Option A : Étendre `MovieDetailResponse` et `EpisodeResponse` dans les contracts pour inclure `progressMs?: number`, renseigner côté backend.
   - Option B : Récupérer la position depuis l'endpoint user-state existant (`GET /user-state/...`) dans les pages detail et la passer au modal.
   - Dans les deux cas, les tests d'intégration existants dans les pages doivent vérifier que `progressMs` est bien transmis au modal quand la progression > 0.

2. **[Suggéré]** Ajouter un lien "Appareils TV" dans `ProfileSettingsPage.tsx` pour respecter le plan §8.

3. **[Cosmétique]** Changer l'icône "Appareils TV" dans `LeftNav` pour éviter le doublon avec "Séries".

4. **[Suggéré]** Ajouter un test dans `EpisodeRow.test.tsx` vérifiant l'affichage conditionnel du bouton 📺 TV et son interaction.
