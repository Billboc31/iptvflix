# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T084/reviews/implementation-review.md
- generated at: 2026-08-16T19:29:57Z

---

---

# PR Review — T084: Repair blank-UI merge regression

## Résumé

T084 vise à corriger la régression introduite par T083 : suppression de 465 artefacts générés commis dans le repo, restauration du pipeline HLS/playback T082, préservation des améliorations de résilience T083, et réparation du flow login.

L'implémentation est structurellement solide sur les axes principaux. Cependant, des tests de régression auth explicitement requis par le ticket sont absents, et le smoke test manuel (marqué BLOCKING par le ticket) n'a pas été effectué.

---

## Vérifications effectuées

- Analyse des fichiers clés modifiés/ajoutés : `AuthContext.tsx`, `ProtectedRoute.tsx`, `App.tsx`, `ErrorBoundary.tsx`, `PreviewContext.tsx`, `usePlayback.ts`, `PlayerPage.tsx`, `PlayerControls.tsx`, `playback.ts` (routes), `playback-resolver.ts`, `hls-session-store.ts`, `playback-compat.ts`, `playback-session-store.ts`, `probe-cache.ts`, `media-prober.ts`, `nixpacks.toml`, `api-contracts/playback.ts`
- Vérification que les artefacts générés ont bien été supprimés du suivi git
- Vérification de la couverture de tests ajoutés
- Comparaison des comportements AuthContext entre T082, T083 et T084

---

## Points validés

### Suppression des artefacts générés (cause racine)
- ✅ Les 465 fichiers `.js`/`.d.ts`/`dist/` commis par T083 sont supprimés du suivi git
- ✅ Le `.gitignore` couvrait déjà ces patterns — aucune modification supplémentaire nécessaire
- ✅ Seul `apps/web/src/vite-env.d.ts` reste suivi, explicitement re-inclus par `!apps/web/src/vite-env.d.ts`

### Pipeline T082 restauré
- ✅ `hls-session-store.ts` : gestion TTL des sessions ffmpeg, nettoyage périodique, protection path traversal (`SEGMENT_RE`)
- ✅ `media-prober.ts` : wrapper ffprobe complet
- ✅ `playback-compat.ts` : `classifyDelivery()` + `buildFfmpegArgs()` pour les 4 modes
- ✅ `playback-session-store.ts` : store in-memory avec TTL 2h
- ✅ `probe-cache.ts` : cache 24h des résultats ffprobe
- ✅ `playback.ts` : 5 routes gateway (resolve, DIRECT stream + Range, segment proxy URI, HLS playlist, HLS segments)
- ✅ `playback-resolver.ts` : pipeline probe→classify→session→gateway, fallback extension si probe échoue
- ✅ Split xtream : `buildXtreamMovieUrl` / `buildXtreamEpisodeUrl` (épisodes via `/series/` path)

### Contrats API mis à jour
- ✅ `PlaybackSessionResponse` : `gatewayUrl`, `deliveryMode`, `probeResult`, `containerExtension` à la place de `streamUrl`
- ✅ `DeliveryMode` type exporté du bon package
- ✅ `usePlayback` et `PlayerPage` cohérents avec le nouveau contrat

### Résilience T083 préservée
- ✅ `ErrorBoundary` wrappant l'app entière dans `App.tsx`
- ✅ `ProtectedRoute` : spinner visible pendant `isLoading` (plus de `return null` silencieux)
- ✅ `PreviewContext` : guard `typeof window.matchMedia === 'function'` correct (init + useEffect)
- ✅ `AuthContext` : boot flow préservé

### Déploiement Railway
- ✅ `apps/api/nixpacks.toml` : `nixPkgs = ["ffmpeg"]`
- ✅ Checks au démarrage : ffmpeg, ffprobe, répertoire tmp accessible

### Tests ajoutés
- ✅ `playback-compat.test.ts` : classifyDelivery + buildFfmpegArgs (127 lignes, bon coverage)
- ✅ `probe-cache.test.ts` : TTL, hit/miss
- ✅ `hls-session-store.test.ts` : cycle de vie session, SEGMENT_RE, path traversal
- ✅ `playback-gateway.test.ts` : 415 lignes, couvre DIRECT MP4, Range, HLS playlist, segments, erreurs upstream
- ✅ `playback-resolver.test.ts` : mis à jour avec le nouveau contrat (`gatewayUrl`, modes de livraison)
- ✅ `ErrorBoundary.test.tsx` : catch render error + fallback personnalisé
- ✅ `useFeaturedMedia.test.ts` : logique de sélection film/série
- ✅ `e2e/tests/playback.spec.ts` : résolution + streaming gateway + vérification absence credentials
- ✅ `test/setup.ts` : stub `window.matchMedia` (fix jsdom)
- ✅ `test/handlers.ts` : split `/api/search` / `/api/search/remote`

---

## Problèmes détectés

### 🔴 P1 — Tests de régression auth absents (requis explicitement par le ticket)

Le ticket liste comme requirements :

> - login success transitions through `AuthContext` + `ProtectedRoute` into the authenticated app
> - login failure is visible and recoverable
> - refresh with valid auth remains authenticated

**Aucun de ces tests n'est présent.** Il n'existe pas de fichiers `AuthContext.test.tsx`, `ProtectedRoute.test.tsx` ou `LoginPage.test.tsx` dans le diff. La couverture existante ne les inclut pas.

Le code lui-même semble fonctionnel (LoginPage distingue 401 de l'erreur générique, ProtectedRoute affiche un spinner pendant le boot, AuthContext démarre avec `isLoading: true`), mais les tests de régression spécifiquement demandés sont absents.

**Correction requise :** Ajouter a minima :
1. Test `AuthContext` : `getMe` succeed → `isAuthenticated=true` ; `getMe` reject → `isAuthenticated=false, isLoading=false`
2. Test `ProtectedRoute` : affiche spinner pendant loading ; redirige vers `/login` si non authentifié ; rend children si authentifié
3. Test `LoginPage` : succès navigue vers `/` ; 401 affiche "Invalid username or password" ; erreur réseau affiche "Login failed"

---

### 🟡 P2 — `AuthContext` : toute erreur `getMe()` est traitée comme "non authentifié"

```ts
.catch(() => {
  setIsAuthenticated(false)
  setUsername(null)
})
```

Le ticket demande explicitement : *"an API/bootstrap error is not misinterpreted as permanent unauthenticated state"*.

En pratique, puisque `isAuthenticated` initialise à `false`, le comportement est identique à T082 (même une erreur 500 ou un timeout réseau aboutissait à la même redirection vers `/login`). Ce n'est pas une régression T084. Mais la distinction entre "non-connecté" et "API indisponible" n'est implémentée ni en T082 ni ici. **Ce point n'est pas bloquant** mais devrait idéalement faire l'objet d'un ticket distinct si la DX doit s'améliorer.

---

### 🟡 P3 — `process.exit(1)` si ffmpeg absent au démarrage

Le check de démarrage tue le processus si ffmpeg/ffprobe n'est pas installé. Cela rompt le démarrage en environnement de développement local sans ffmpeg. Le ticket est explicitement axé sur Railway, où nixpacks installe ffmpeg. Acceptable comme choix de design pour Railway, mais risque de friction pour les contributeurs locaux.

---

### 🟡 P4 — Test "aucun artefact compilé dans git" absent

Le ticket demande : *"no generated source-tree compiler artifacts are produced/tracked by normal tests/build"* comme test de régression. Aucun test automatisé ne vérifie cette propriété (e.g., un test qui exécute `tsc` et vérifie que `git status` ne produit pas de nouveaux `.js` dans `src/`).

---

### ℹ️ P5 — Smoke test manuel non effectué (bloquant selon le ticket)

L'implementation-output l'indique explicitement : *"BLOCKING: awaiting manual smoke test"*. Le ticket l'exige avant de considérer le ticket complet. Cette validation ne peut pas être effectuée automatiquement et doit être faite manuellement en environnement production-like.

---

## Risques éventuels

- **Régression déploiement si CI n'a pas ffmpeg** : le startup check forcera l'arrêt en CI si ffmpeg n'est pas disponible dans le runner. À vérifier contre la configuration CI existante.
- **HEAD probe sur erreur vidéo** (`checkGatewayStatus()` dans `PlayerPage`) : ajoute une requête supplémentaire asynchrone sur chaque erreur vidéo. Comportement correct mais latence d'affichage légèrement augmentée en cas d'erreur.

---

## Décision

REQUEST_CHANGES

---

## Actions demandées

1. **[Bloquant]** Ajouter les 3 tests auth requis par le ticket :
   - `AuthContext` : boot flow (success / error / loading transitions)
   - `ProtectedRoute` : spinner loading / redirect unauthenticated / render authenticated
   - `LoginPage` : submit success → navigate ; 401 → message erreur identifiants ; erreur générique → message erreur générique

2. **[Recommandé]** Ajouter un test ou un script CI qui vérifie qu'après `tsc --build`, aucun `.js`/`.d.ts` n'apparaît dans `git status` sur `apps/web/src/`.

3. **[Non-bloquant, à documenter]** Clarifier dans un commentaire `index.ts` ou un `README` que ffmpeg est requis au runtime (pas seulement en Railway), de sorte que les développeurs locaux sachent l'installer.

4. **[Post-merge obligatoire]** Effectuer le smoke test manuel complet (login + refresh + Home/Films/Series + bouton Regarder + erreur playback isolée) sur un environnement production-like avant de marquer le ticket complet.

IMPLEMENTATION_FIX_REQUIRED
