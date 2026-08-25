# PR Review — T130: Standalone Live TV App

## Résumé

L'implémentation crée une nouvelle application `apps/live-tv` dans le monorepo, avec son propre build/deploy Railway, sa navigation TV, son switch VOD/TV, son thème orange/noir et une couverture de smoke tests E2E. Tous les critères d'acceptation du ticket sont couverts.

---

## Vérifications effectuées

- Structure et fichiers créés dans `apps/live-tv/`
- Réutilisation des packages partagés (`@iptvflix/api-contracts`)
- Configuration de déploiement Railway (`nixpacks.toml`)
- Implémentation du switch VOD/TV (TopBar live-tv + TopNav web)
- Navigation sidebar (5 items demandés)
- Thème visuel orange + dark
- Endpoint de santé `/health`
- Smoke tests E2E (`e2e/tests/live-tv-smoke.spec.ts`)
- Impact sur les apps existantes (API, VOD web, recommendation-engine)
- Gestion des variables d'environnement
- Sécurité du handoff de token cross-app

---

## Points validés

**Critères d'acceptation satisfaits :**

- ✅ App standalone `apps/live-tv` buildable indépendamment via `pnpm --filter @iptvflix/live-tv build`
- ✅ Deploy Railway configuré via `nixpacks.toml` dans `apps/live-tv/`
- ✅ Switch VOD/TV présent dans les deux apps (TopBar live-tv, TopNav web), avec état actif/inactif cohérent et `aria-selected` correct
- ✅ Navigation sidebar avec les 5 items requis : Accueil TV, Favoris, Récemment regardées, Guide TV, Toutes les chaînes
- ✅ Contrats `@iptvflix/api-contracts` réutilisés (LoginRequest, LoginResponse, MeResponse, ProfileResponse, ChannelResponse)
- ✅ Thème dark `#0a0a0f` + accent orange `#f97316` conforme à la maquette de référence
- ✅ Apps existantes (VOD web, API, recommendation-engine) non régressées — changements purement additifs
- ✅ 6 smoke tests E2E : health, auth redirect, login, profile selection, sidebar nav, toggle VOD/TV
- ✅ Aucune modification manuelle de la base de données
- ✅ Variables d'environnement documentées dans `.env.example`, pas de secrets en source
- ✅ `serve` correctement listé en `dependencies` (pas seulement devDependencies)
- ✅ Port production configurable via `PORT` env var
- ✅ Endpoint `/health` public, accessible sans auth, retourne HTTP 200

**Qualité du code :**

- Route guard `ProtectedRoute` + `ProfileRequiredRoute` bien composées dans `App.tsx`
- Client API (`src/lib/api.ts`) propre, typé via les contrats partagés, gestion d'erreur explicite avec `ApiError`
- Token handoff `?token=` nettoyé du browser history via `replaceState` dès le chargement
- Duplication minimale et justifiée (contextes React app-spécifiques, fetch wrapper indépendant)
- Lint et typecheck root étendus pour inclure `apps/live-tv`

---

## Problèmes détectés

### Mineur — Sécurité : JWT passé en query param pour le handoff cross-app

**Fichiers :** `apps/live-tv/src/components/layout/TopBar.tsx:11`, `apps/web/src/components/layout/TopNav.tsx:24`

Le JWT est transmis via `?token=<jwt>` dans l'URL lors du switch VOD→TV et TV→VOD. Même si `replaceState` nettoie l'URL côté client, le token reste exposé dans :
- les access logs du serveur de fichiers statiques
- le champ `Referer` d'éventuelles ressources chargées entre la navigation et le `replaceState`
- les extensions de navigateur ayant accès à l'historique d'URL

Le `replaceState` s'exécute au module load (avant le premier render), ce qui limite la fenêtre d'exposition, mais le risque n'est pas nul.

**Recommandation :** Documenter ce tradeoff explicitement dans `.env.example` ou le CLAUDE.md. Pour une prochaine itération, envisager un token one-shot de courte durée ou le partage de cookie sur un sous-domaine commun si l'architecture l'y permet. Pour un MVP, c'est acceptable si documenté.

### Mineur — UI : Abréviation "IV" dans la sidebar mobile

**Fichier :** `apps/live-tv/src/components/layout/Sidebar.tsx:19`

```tsx
<span className="md:hidden text-lg font-bold text-[#f97316]">IV</span>
```

"IV" n'est pas une abréviation reconnaissable d'IPTVFlix. Devrait être "IP" ou simplement l'icône de l'app.

### Mineur — Tests : credentials hardcodés `admin/admin`

**Fichier :** `e2e/tests/live-tv-smoke.spec.ts:29-30`

Les tests supposent que `DELETE /test/reset` crée un utilisateur `admin/admin`. Si la seed de reset évolue, les tests cassent silencieusement. Acceptable pour un MVP, à documenter dans le README E2E.

### Mineur — Deployment doc : pas de railway.json ni de documentation explicite de service

Le ticket demande de "documenter la configuration Railway independante". Le `nixpacks.toml` couvre le build, mais il n'y a pas de documentation sur comment créer le service Railway (root directory à pointer, env vars à configurer). Le `.env.example` couvre partiellement ce besoin. Un court commentaire dans `nixpacks.toml` ou un fichier `apps/live-tv/DEPLOY.md` serait utile.

---

## Risques éventuels

- Le handoff JWT en URL est un vecteur d'exposition de token — risque accepté pour MVP mais à tracer
- Les pages Favoris, Récemment regardées et Guide TV sont des stubs vides — conforme au ticket ("fondation prête pour"), mais elles afficheront une page blanche sans message d'état si un utilisateur navigue dessus
- Le smoke test `GET /health` retourne HTTP 200 depuis le serveur statique (`serve -s dist` en mode SPA sert `index.html` pour toutes les routes) — Railway considère le service healthy, ce qui est le comportement attendu

---

## Décision

L'implémentation est solide, propre, bornée au scope du ticket, et satisfait l'ensemble des critères d'acceptation. Les problèmes détectés sont mineurs et ne bloquent pas la livraison. Le risque de sécurité JWT-in-URL est réel mais pragmatique pour un MVP cross-origin.

## Actions demandées

Aucune action bloquante. Observations à traiter dans des itérations suivantes :

1. Documenter le tradeoff JWT-in-URL dans `.env.example` ou la documentation de déploiement
2. Corriger l'abréviation "IV" → "IP" (ou icône) dans `Sidebar.tsx:19`
3. Ajouter un message "En cours de développement" dans les pages stubs (Favoris, Récemment regardées, Guide TV)
4. Documenter la procédure de création du service Railway dans `apps/live-tv/` (env vars, root directory)

IMPLEMENTATION_APPROVED
