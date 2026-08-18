Now I have all the information I need. Let me compile the full review.

---

# PR Review — T099 : Profile Selector and Profile Management UX (attempt 2)

## Résumé

Il s'agit d'une seconde review après `IMPLEMENTATION_FIX_REQUIRED`. Les trois corrections demandées lors de la review précédente ont toutes été appliquées. L'implémentation couvre l'intégralité du périmètre : sélecteur web (popover + page chooser), gestion CRUD des profils, système d'avatar à 8 clés stables, invalidation de cache via `profileVersion`, écran "Qui regarde ?" Android TV avec navigation D-pad, et switch in-app TV. 362 tests passent (+2 nouveaux).

---

## Corrections vérifiées depuis la review précédente

### [BLOQUANT résolu] Test "switch while progress exists" — token timing invariant

`apps/web/src/__tests__/ProfileContext.test.tsx:115-148`

Le test `JWT token is only updated after selectProfile API resolves — no cross-profile progress leakage` est présent. Il :
1. Suspend l'appel API `/profiles/:id/select` via une promise contrôlée
2. Vérifie que `localStorage` n'est **pas** mis à jour tant que l'API n'a pas répondu
3. Documente explicitement en commentaire l'isolation architecturale (PlayerPage hors AppShell)

L'architecture confirme l'invariant : dans `App.tsx:72`, `/player/:mediaType/:mediaId` est monté directement sous `ProfileRequiredRoute`, hors du `<Route element={<AppShell />}>` (ligne 76) qui contient `ProfileSwitcherPopover`. Un switch de profil déclenché depuis le switcher est donc architecturalement impossible pendant la lecture — le test documente cette garantie.

### [MINEUR résolu] Bouton "+ Ajouter" désactivé à la limite `maxProfiles`

`apps/web/src/pages/ProfileManagePage.tsx:48-63`

- `disabled={profiles.length >= MAX_PROFILES}` ✅
- Message proactif "Vous avez atteint la limite de X profils" ✅
- Tooltip via `title` ✅
- Couvert par `ProfileManage.test.tsx:80-94` (5 profils → bouton disabled + message visible) ✅

### [OPTIONNEL résolu] `ProfileSettingsPage` dépend maintenant de `currentProfile?.id`

`apps/web/src/pages/ProfileSettingsPage.tsx:231-241`

`useEffect` dépend de `[currentProfile?.id]` avec `setLoading(true)` au début de l'effet — les préférences sont correctement rechargées à chaque changement de profil actif, y compris via l'historique du navigateur.

---

## Points structurels confirmés valides

**Invalidation de cache** : `useContinueWatching`, `useWatchlist`, `useShelves` (via `useProfile()` interne) et `useHome` (paramètre explicite) dépendent tous de `profileVersion` — aucun contenu stale cross-profil n'est possible.

**Séparation account/profil** : Les credentials sources (Xtream/M3U/Plex) restent sur `/settings/devices`, inaccessibles depuis les pages profil. `ProfileSettingsPage` expose uniquement des préférences profil-level (langues audio/sous-titres, priorité sources, qualité max, autoplay).

**Android TV** : `AppNavGraph` impose `WhoIsWatchingScreen` à chaque lancement (pre-focus lastUsed, sélection explicite obligatoire). `BackHandler` présente "Quitter l'application ?" sans toucher au token account. `HomeScreen.onChangeProfile` retourne au chooser sans re-auth.

**Sécurité** : JWT mis à jour uniquement après résolution API, `clearLastProfileId()` appelé au logout, UUIDs profil non exposés en UI normale.

---

## Risques résiduels (non bloquants, pré-existants)

**Build Android TV non exécutable localement** (SDK absent, pré-existant à T099) : les fichiers Kotlin sont syntaxiquement cohérents avec les patterns du projet, mais la compilation native doit être validée en CI avant merge.

**Validation manuelle non documentée** : la "Completion rule" du ticket requiert une démonstration avec un compte réel à 3 profils sur Web/Mobile et Android TV, avec validation du Continue Watching et My List distincts. Cette validation ne peut pas être vérifiée en code review et doit être réalisée avant fermeture du ticket.

---

## Décision

Toutes les corrections bloquantes et mineures demandées lors de la review précédente ont été correctement appliquées. L'implémentation respecte le ticket, l'architecture, les conventions de sécurité et la qualité de code attendue.

IMPLEMENTATION_APPROVED
