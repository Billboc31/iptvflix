Now I have a complete picture. Let me write the second review.

---

# PR Review — T007: Build Netflix-inspired web experience (tentative 2)

## Résumé

Cette review fait suite à `IMPLEMENTATION_FIX_REQUIRED` (tentative 1). Les deux points bloquants identifiés lors de la première review ont été correctement résolus. 26/26 tests passent, TypeScript compile sans erreur, et aucun DTO Xtream ne fuite dans les composants UI. Les problèmes modérés restants sont des limitations fonctionnelles connues et acceptables pour une fondation V1.

---

## Vérifications effectuées

| Vérification | Statut |
|---|---|
| `vitest run` — 26/26 tests | ✅ |
| `tsc --noEmit` — 0 erreur | ✅ |
| BLOQUANT 1 corrigé — liens nav vers écran vide | ✅ |
| BLOQUANT 2 corrigé — polling sync onboarding | ✅ |
| Aucune fuite de DTO Xtream dans `apps/web/src/` | ✅ |
| Coverage des 8 routes requises | ✅ |
| États loading/empty/error présents | ✅ |
| Scope exclu absent (playback, TMDB, Android TV) | ✅ |
| Contrats API canoniques dans `packages/api-contracts/` | ✅ |

---

## Points validés

**BLOQUANT 1 — Liens nav désactivés (résolu)**
`apps/web/src/components/layout/LeftNav.tsx:14-16` — Les trois items `disabled: true` (Radar Cinéma, Ma Liste, Historique) rendent maintenant comme des `<div>` avec `opacity-40 cursor-not-allowed select-none` et `title="Fonctionnalité à venir"`. Aucun `NavLink` ne pointe vers une route non déclarée. Comportement correct.

**BLOQUANT 2 — Polling sync onboarding (résolu)**
`apps/web/src/pages/OnboardingPage.tsx:31-46` — `handleSync` implémente un polling récursif sur `listSyncRuns()` toutes les 2 s jusqu'à `status === 'DONE' | 'FAILED'`. L'étape 3 n'est déclenchée qu'une fois le run terminé. Le cas d'erreur est géré avec `setSyncError`. Comportement correct.

**Architecture**
Découpage `ui/content/sources/layout` propre. Hooks isolés (`useSync`, `useSources`, `useMovies`, `useSeries`). Client API unique en `lib/api.ts`. `Toast` via context provider.

**Contrats canoniques**
`packages/api-contracts/src/` : `catalog.ts`, `sync.ts`, `sources.ts` — aucun type Xtream dans les pages ou composants. Export `index.ts` additif, compatible backward.

**Tests**
7 fichiers de test, 26 assertions, couverture MSW complète pour tous les endpoints testés. Handlers cohérents.

---

## Problèmes détectés

### 🟡 MODÉRÉ (non bloquant) — Sync global toujours hardcodé sur `sources[0]`

**Fichier** : `apps/web/src/pages/SourcesPage.tsx:70`

Signalé en tentative 1, non corrigé. Pour un utilisateur multi-sources le bouton "Synchroniser" du banner ne synchronise que la première source de la liste. `SourceCard` n'expose pas de bouton de sync par source. Acceptable pour cette fondation V1 mais à traiter dans un ticket de suivi avant toute mise en production avec plusieurs sources.

---

### 🟡 MODÉRÉ (non bloquant) — "Tester la connexion" mode édition uniquement

**Fichier** : `apps/web/src/components/sources/SourceForm.tsx:135`

Signalé en tentative 1, non corrigé. Contrainte API réelle (`testSource` exige un `id` existant). Acceptable pour V1.

---

### 🟡 MODÉRÉ (non bloquant) — Filtre "Disponibilité" absent du catalogue

**Fichier** : `apps/web/src/components/content/FilterBar.tsx`

Signalé en tentative 1, non corrigé. Le contrat `MovieFilters` ne contient pas de champ `availability` — la contrainte est backend. Acceptable en l'absence de l'endpoint correspondant.

---

### 🔵 MINEUR — Icônes emoji dans la navigation

**Fichier** : `apps/web/src/components/layout/LeftNav.tsx`

Rendu emoji non uniforme selon l'OS. À remplacer par une bibliothèque SVG (ex. `lucide-react`) dans une itération suivante.

---

### 🔵 MINEUR — React Router v6 Future Flags warnings dans les tests

Warnings `v7_startTransition` et `v7_relativeSplatPath` non bloquants. À adresser avant migration v7.

---

## Risques éventuels

- **Sécurité** : aucun secret hardcodé, `VITE_API_BASE` via `.env`, mot de passe source jamais loggué. ✅
- **Régressions** : changements dans `packages/api-contracts` sont additifs. Aucun composant existant modifié de manière destructive. ✅
- **Memory leak potentiel** : le `setTimeout` récursif dans `OnboardingPage.handleSync` n'est pas annulé si le composant se démonte entre deux appels. Dans le cadre d'un wizard d'onboarding linéaire et non démontable pendant la sync, ce risque est marginal. À surveiller.

---

## Décision

Les deux blocages de la tentative 1 sont résolus correctement. L'implémentation constitue une fondation frontend solide, typée et testée. Les trois points modérés restants sont des limitations connues sans comportement trompeur — ils seront traités dans des tickets de suivi. Les mineurs sont purement cosmétiques.

IMPLEMENTATION_APPROVED
