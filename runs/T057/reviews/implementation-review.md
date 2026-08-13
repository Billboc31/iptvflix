I now have a complete picture. Let me write the final review.

---

# PR Review — T057: Add Web 'Play on TV' device picker and remote handoff UX (attempt 2)

## Résumé

La deuxième implémentation résout le problème bloquant de la première review et adresse tous les points mineurs signalés. Les 157 tests passent. L'implémentation est conforme au ticket et au plan.

---

## Vérifications effectuées

- Lecture du diff entre commit de review 1 (`88abd1b`) et commit de fix (`1a8d393`)
- Vérification du câblage `progressMs` dans `MovieDetailPage`, `SeriesDetailPage`, `SeasonAccordion`, `EpisodeRow`
- Vérification du type `ContinueWatchingItem` dans `packages/api-contracts/src/user-state.ts`
- Vérification du handler MSW `continue-watching` dans `handlers.ts`
- Vérification des 3 nouveaux tests `EpisodeRow.test.tsx`, des fixes `ProfileSettingsPage.test.tsx`
- Exécution des tests : **157 tests, 23 fichiers, 100 % pass**

---

## Problème bloquant précédent — RÉSOLU ✅

**AC #5 — Resume/depuis le début désormais fonctionnel en production**

Le câblage est complet et correct :

- `MovieDetailPage` : `Promise.allSettled([getMovie(id), fetchContinueWatching()])` → trouve l'item `mediaType === 'MOVIE' && mediaId === id` → `progressMs = item.progressSeconds * 1000` → passé à `DevicePickerModal`. Si le continue-watching échoue, `progressMs` reste à 0 silencieusement (comportement de dégradation gracieux correct).
- `SeriesDetailPage` : `fetchContinueWatching()` séparé → construit `Record<episodeId, progressMs>` pour les items `EPISODE` → passé à `SeasonAccordion` → `EpisodeRow` → `DevicePickerModal`.
- `ContinueWatchingItem.progressSeconds` est typé `number` (non optionnel), la conversion `×1000` est fiable.
- Le handler MSW `/api/continue-watching` retourne déjà `MOCK_CONTINUE_WATCHING` avec `progressSeconds: 60`.

---

## Points mineurs précédents — RÉSOLUS ✅

- **LeftNav icon doublon** : `📺` → `🖥️` pour "Appareils TV". ✅
- **ProfileSettingsPage lien manquant** : ajout d'une card "Appareils TV" avec lien `Gérer →` vers `/settings/devices`. ✅ Le test `ProfileSettingsPage.test.tsx` est corrigé (wraps `MemoryRouter`). ✅
- **EpisodeRow sans tests TV button** : 3 nouveaux tests couvrant l'affichage conditionnel (avec/sans appareils, épisode indisponible). ✅

---

## Points validés

- **AC ticket** — Tous les critères sont couverts :
  - Pairing via code 8 caractères avec validation + erreurs spécifiques (expired, unknown) ✅
  - Affichage des appareils avec nom, statut online/offline, rename, revoke ✅
  - Movie → "Play on TV" → picker / fast-path ✅
  - Episode → handoff avec `mediaType: 'episode'` et `mediaId` correct ✅
  - Resume/from-start toggle câblé à la progression réelle ✅
  - Fast-path one-tap pour appareil unique avec toast nommant la cible ✅
  - Offline/révoqué → UI clair, pas de succès silencieux ✅
  - Web local Play préservé ✅
  - Tests couvrant tous les cas requis : 157 pass ✅

- **Plan §1–§8** — Tous implémentés conformément au plan ✅
- **Qualité** — Code lisible, mutations optimistes cohérentes, gestion d'erreur explicite ✅
- **Sécurité** — Pas de direct browser-to-TV, header d'authentification existant réutilisé ✅

---

## Observation résiduelle (non bloquante)

Aucun test de page (`MovieDetailPage.test.tsx`, `SeriesDetailPage.test.tsx`) ne vérifie que la valeur `progressMs` réelle issue de `fetchContinueWatching` est bien transmise jusqu'au modal en conditions d'intégration. Le handler MSW est en place et prêt, mais le cas n'est pas exercé au niveau page. L'implémentation production est correcte ; la couverture manquante est un angle mort mineur acceptable dans ce périmètre.

---

## Décision

L'implémentation est conforme au ticket, au plan, et à l'ensemble des critères d'acceptation. Le problème bloquant est résolu. Tous les points mineurs sont adressés. Les 157 tests passent.

IMPLEMENTATION_APPROVED
