# PR Review — T001: Initialize IPTVFlix monorepo foundation

## Résumé

Implémentation complète et propre du ticket T001. Tous les critères d'acceptance sont satisfaits. Le périmètre est rigoureusement respecté. Aucun problème bloquant identifié.

## Vérifications effectuées

- Structure du monorepo (apps/, packages/, racine)
- Configuration pnpm workspace
- API Fastify : server, CORS, health route, test Vitest
- Web React/Vite : proxy dev, shell minimal, fetch API
- Package partagé api-contracts
- Squelette Android TV : Gradle, Kotlin, Manifest Leanback
- ESLint flat config, Prettier, tsconfig.base.json
- .gitignore : node_modules, dist, .env, Android build dirs
- Fichiers .env.example présents, aucun .env commité
- README : structure, prérequis, commandes

## Points validés

- **Critère 1 — Installation** : `pnpm install` documenté dans le README, pnpm-workspace.yaml couvre `apps/*` et `packages/*`.
- **Critère 2 — Démarrage API + web** : scripts `dev` individuels et `pnpm dev` parallèle documentés. Le filtre `./apps/*` exclut naturellement `apps/android-tv` qui n'est pas un package pnpm.
- **Critère 3 — Health endpoint** : `GET /health` → `{ status: 'ok' }`, typé via `HealthResponse`, testé avec Vitest inject.
- **Critère 4 — Web shell + communication API** : Vite proxy `/api` → `http://localhost:3000` avec réécriture de path ; App.tsx fetche `/api/health` au montage et affiche le statut.
- **Critère 5 — Android TV skeleton** : Gradle 8.7 wrapper, Kotlin 2.0, AGP 8.5, Manifest avec `LEANBACK_LAUNCHER`, dépendances Compose for TV et Media3 présentes en commentaires.
- **Critère 6 — Lint/typecheck/test** : scripts racine délèguent correctement aux workspaces via `--filter`; ESLint flat config TS + Prettier; tsconfig.base.json strict + ESNext + bundler resolution.
- **Critère 7 — Secrets non commités** : uniquement des `.env.example`, `.gitignore` couvre `.env`, `.env.local`, `.env.*.local`.
- **Critère 8 — README** : diagramme de structure, prérequis (Node ≥20, pnpm ≥9, JDK ≥17, Android SDK 34), commandes install/dev/quality, section Android TV, section API.

## Problèmes détectés

### Mineur — `api-contracts` sans script `build`

Le script racine `"build"` appelle `pnpm --filter './packages/*' build`, mais `packages/api-contracts/package.json` n'a pas de script `build`. En pnpm v9 ce cas est silencieusement ignoré (pas d'erreur). Le package exporte directement la source TypeScript (`./src/index.ts`), ce qui est un pattern valide pour un package interne consommé uniquement en TypeScript.

Impact : aucun (le ticket ne teste pas `pnpm build` dans les critères d'acceptance). À documenter ou corriger avant que la CI produise des artefacts de distribution.

### Mineur — `MainActivity.kt` utilise `AppCompatActivity`

Le plan mentionnait `ComponentActivity` ; l'implémentation utilise `AppCompatActivity`. Pour le scope actuel (Leanback, sans Compose), `AppCompatActivity` est acceptable. À migrer vers `ComponentActivity` quand Jetpack Compose for TV sera activé.

### Observation — Root `.env.example` vide

Le fichier `.env.example` racine contient uniquement un commentaire ("none required yet"). Ce n'est pas un problème, mais il pourrait être supprimé ou conservé explicitement pour signaler que des variables root pourront être ajoutées.

## Risques éventuels

- Le proxy Vite rewrite `path.replace(/^\/api/, '')` est correct mais ne coverera pas les chemins d'API commençant par `/api` dans les URLs générées par le backend. Acceptable pour ce périmètre.
- `host: '0.0.0.0'` sur le serveur Fastify expose l'API sur toutes les interfaces en dev — comportement attendu pour le dev local mais à ne pas transposer tel quel en production.

## Décision

**APPROVED** — Tous les critères d'acceptance du ticket T001 sont satisfaits. Le code est propre, correctement scopé, sans secrets commités. Les points mineurs identifiés ne bloquent pas la validation.

## Actions demandées

Aucune action bloquante. Pour la suite :
- Ajouter un script `build` à `packages/api-contracts` (ex : `tsc --declaration`) avant la mise en place d'une CI de build.
- Migrer `MainActivity` vers `ComponentActivity` au moment d'activer Compose for TV.
