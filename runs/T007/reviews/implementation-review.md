Now I have everything I need to write the review. Let me produce the structured report.

---

# PR Review — T007: Build Netflix-inspired web experience

## Résumé

L'implémentation livre une base frontend solide et typée (React 18 + TypeScript + Tailwind CSS v4). La structure de composants, le shell applicatif, les hooks, les pages et les contrats API répondent globalement au scope du ticket. Les tests passent (26/26), le compilateur TypeScript ne signale aucune erreur, et aucun DTO Xtream ne fuite dans les composants UI. Deux problèmes bloquants identifiés, plusieurs points mineurs.

---

## Vérifications effectuées

| Vérification | Statut |
|---|---|
| `vitest run` — 26/26 tests | ✅ |
| `tsc --noEmit` — 0 erreur | ✅ |
| Respect des contrats API canoniques | ✅ |
| Aucune fuite de DTO Xtream dans `apps/web/src/` | ✅ |
| Coverage des pages requises (8 routes) | ✅ |
| États loading/empty/error présents | ✅ |
| Scope exclu absent du code | ✅ (playback, TMDB, recommendation, Android TV) |
| Cohérence visuelle avec le design board | Partielle (voir problèmes) |

---

## Points validés

- **Architecture** : découpage clair `ui/content/sources/layout`, hooks isolés, client API unique en `lib/api.ts`.
- **Contrats API** : `catalog.ts`, `sync.ts`, `sources.ts` dans `packages/api-contracts` — aucun type Xtream dans les pages ou composants.
- **Thème** : palette dark (`#0a0a0f`, `#111118`, `#e50914`) fidèle au board de référence.
- **Composants réutilisables** : `PosterCard`, `HeroSection`, `HorizontalRow`, `PosterGrid`, `FilterBar`, `Button`, `Dialog`, `Toast`, `Badge`, `Skeleton`, `EmptyState`, `ErrorState`.
- **Navigation active** : `NavLink` avec `border-r border-[#e50914]` signale la route courante.
- **Sync auto-poll** : `useSync` relance toutes les 3 s tant qu'un run est `PENDING | RUNNING`.
- **Onboarding wizard** : 3 étapes structurées, source créée avant de passer à l'étape 2.
- **MSW mocking** : handlers cohérents couvrant tous les endpoints testés.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Liens nav menant à un écran vide

**Fichier** : `apps/web/src/components/layout/LeftNav.tsx:9-18`

Trois entrées de nav pointent vers des routes non déclarées dans `App.tsx` :

```
{ label: 'Radar Cinéma', to: '/radar', icon: '🎭' }
{ label: 'Ma Liste',     to: '/list',  icon: '❤️' }
{ label: 'Historique',  to: '/history', icon: '🕐' }
```

React Router ne matche aucune `<Route>` pour ces paths → la zone de contenu reste **vide** sans erreur. Un utilisateur qui clique voit un écran noir. Les fonctionnalités sont exclues du ticket mais les liens doivent soit être désactivés visuellement, soit pointer vers une page "Fonctionnalité à venir".

**Correction attendue** : Ajouter `pointer-events-none opacity-40` sur ces items (classe conditionnelle) ou créer une route catch-all qui affiche un `EmptyState` avec un message explicite.

---

### 🔴 BLOQUANT 2 — Onboarding step 2 : fausse confirmation de sync terminé

**Fichier** : `apps/web/src/pages/OnboardingPage.tsx:26-43`

```tsx
const run = await triggerSync({ sourceId })
if (run.status === 'FAILED') {
  setSyncError(run.error ?? 'Erreur inconnue')
} else {
  setSyncDone(true)           // ← déclenché même si run.status === 'PENDING'
  setTimeout(() => setStep(3), 1500)
}
```

`triggerSync` retourne le run avec `status: 'PENDING'`. La condition `=== 'FAILED'` est fausse → `syncDone = true` et le wizard avance à l'étape 3 au bout de 1,5 s alors que la synchronisation n'est pas terminée. L'utilisateur pense que son catalogue est importé alors qu'il ne l'est pas.

**Correction attendue** : Après `triggerSync`, boucler en polling (`setInterval` ou récursif `setTimeout`) sur `listSyncRuns()` jusqu'à `status === 'DONE' | 'FAILED'`, puis progresser ou afficher l'erreur.

---

### 🟡 MODÉRÉ 1 — "Tester la connexion" inaccessible à la création

**Fichier** : `apps/web/src/components/sources/SourceForm.tsx:135`

```tsx
{initial && onTest && (
  <Button ...>Tester la connexion</Button>
)}
```

Le design board montre le bouton "Tester la connexion" dans le formulaire d'ajout d'une source. L'API `testSource(id)` exige un `id` existant — la contrainte est réelle — mais l'UX peut être résolue en affichant "Enregistrer puis tester" ou en proposant un test après sauvegarde. Actuellement, les nouveaux utilisateurs ne peuvent pas tester avant de valider leur source dans le formulaire principal (seule l'édition le permet).

---

### 🟡 MODÉRÉ 2 — Sync hardcoded sur `sources[0]`

**Fichier** : `apps/web/src/pages/SourcesPage.tsx:67`

```tsx
await triggerSync(sources[0].id)
```

Si l'utilisateur possède plusieurs sources, le bouton "Synchroniser" déclenche toujours la première. Le design board montre un contrôle de sync par source dans `SourceCard`. À corriger ou documenter explicitement comme simplification temporaire.

---

### 🟡 MODÉRÉ 3 — Filtre "Disponibilité" absent du catalogue

**Fichier** : `apps/web/src/components/content/FilterBar.tsx`

Le design board (écran "Catalogue Films") affiche quatre filtres : Genres, Années, **Disponibilité**, Qualité. Le FilterBar n'implémente que Genres, Années et Qualité (optionnel). `MovieFilters` ne contient pas de champ `availability` dans les contrats actuels, ce qui nécessiterait une extension du contrat pour l'implémenter. Point mineur en l'absence du backend correspondant mais écart visuel notable avec le board.

---

### 🔵 MINEUR 1 — Icônes emoji dans la navigation

**Fichier** : `apps/web/src/components/layout/LeftNav.tsx`

Le design board utilise des icônes vectorielles. L'implémentation utilise des emoji Unicode (`🏠`, `🎬`, `📺`, etc.). Rendu inconsistant selon l'OS (Apple Emoji vs Twemoji). Acceptable pour une fondation mais à remplacer par une bibliothèque SVG dans une itération suivante.

---

### 🔵 MINEUR 2 — Avertissements React Router v6 Future Flags

Les tests affichent des warnings `v7_startTransition` et `v7_relativeSplatPath`. Non bloquants pour cette version mais à résoudre avant la migration vers React Router v7.

---

## Risques éventuels

- **Sécurité** : aucun secret hardcodé, `VITE_API_BASE` via `.env`. Le mot de passe de source n'est jamais loggué. ✅
- **Régressions** : aucun composant existant modifié de manière destructive. Les changements dans `packages/api-contracts` sont additifs. ✅
- **Dépendances** : toutes justifiées par le ticket (react-router-dom, tailwindcss, vitest, msw). ✅

---

## Décision

Les deux points bloquants (liens nav → écran vide, confirmation de sync prématurée dans l'onboarding) produisent des comportements trompeurs pour l'utilisateur final et ne sont pas acceptables dans une fondation sur laquelle vont s'appuyer les tickets suivants.

IMPLEMENTATION_FIX_REQUIRED
