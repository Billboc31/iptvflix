# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T099/reviews/implementation-review.md
- generated at: 2026-08-18T09:41:07Z

---

Now I have everything I need. Let me write the review.

---

# PR Review — T099: Profile Selector and Profile Management UX

## Résumé

L'implémentation couvre l'ensemble du périmètre du ticket : sélecteur de profil web (chooser + popover), pages de gestion (créer/modifier/supprimer), système d'avatar, invalidation de cache via `profileVersion`, écran "Qui regarde ?" Android TV avec navigation D-pad, et switch in-app TV. L'architecture est propre et bien séparée. Les tests API et Web sont présents et passent (360/360 Web, 19+ API).

Un test explicitement requis par le ticket est absent. Un écart mineur existe entre le plan et l'implémentation sur la contrainte `maxProfiles` dans l'UI.

---

## Vérifications effectuées

- Lecture du plan `runs/T099/plan.md` et des critères d'acceptation du ticket
- Lecture et vérification des fichiers clés : `ProfileContext.tsx`, `ProfileSwitcherPopover.tsx`, `ProfileManagePage.tsx`, `ProfileCreatePage.tsx`, `App.tsx`, `WhoIsWatchingScreen.kt`, `AppNavGraph.kt`, `api.ts` (selectProfile/upsertProgress), `useProgressSync.ts`, `useContinueWatching.ts`, `useHome.ts`, `useShelves.ts`, `useWatchlist.ts`, `ProfileSettingsPage.tsx`, `profiles.ts` (route API)
- Vérification de la liste complète des fichiers modifiés (356 fichiers, node_modules exclus : ~140 fichiers réels)
- Vérification de la couverture des tests requis
- Analyse du flux token lors d'un switch de profil

---

## Points validés

**Architecture et séparation des concerns**
- `ProfileContext` isole correctement l'état de profil (currentProfile, profiles, profileVersion, selectProfile, refreshProfiles) — aucune logique de profil éparpillée dans les composants
- `ProfileRequiredRoute` redirige proprement vers `/profiles/choose` quand `currentProfile === null`
- `ProfileProvider` est inscrit sous `ProtectedRoute`, donc détruit à la déconnexion — pas de fuite d'état entre sessions

**Invalidation du cache profil**
- `useContinueWatching`, `useWatchlist`, `useShelves` lisent tous `profileVersion` via `useProfile()` et le placent en dépendance d'`useEffect` — conforme au plan
- `useHome` reçoit `profileVersion` en paramètre explicite et l'inclut dans ses deps — légèrement inconsistant (les autres hooks lisent le contexte en interne) mais correct

**Gestion du token**
- `apiSelectProfile` appelle `setStoredAuthToken(res.token)` — le nouveau JWT profil écrase proprement l'ancien dans localStorage
- Le `selectProfile` du contexte ne stocke pas l'ID en localStorage avant le succès API — pas de divergence optimiste
- `ProfileSwitcherPopover.handleSelect` appelle `navigate('/', { replace: true })` après le switch — la page Player est hors AppShell et donc hors de portée du switcher, ce qui neutralise le risque de race condition sur `upsertProgress`

**Sécurité et boundary account/profil**
- `ProfileSettingsPage` affiche uniquement des préférences profil-level (`preferredAudioLanguages`, `preferredSubtitleLanguages`, `preferredSourceIds`, `maxVideoQuality`, `autoplayPreviews`) — `preferredSourceIds` est bien un champ de priorité profil, pas une configuration de source account-level
- Les credentials sources (Xtream/M3U/Plex) restent sur `/sources` → `SourcesPage`, inaccessible depuis les pages profil
- UUID de profil non exposé dans l'UI normale — seul `avatarKey` est visible

**Android TV**
- `AppNavGraph`: flow correct `Pairing → WhoIsWatching → Home → Player` ; le WhoIsWatchingScreen est montré à chaque lancement, même si `lastUsedProfileId` existe (pre-focus uniquement, pas d'auto-sélection)
- `BackHandler` sur WhoIsWatchingScreen : ouvre une dialog "Quitter l'application ?" — ne déconnecte pas le compte
- `HomeScreen.onChangeProfile` → retour vers `WhoIsWatchingScreen` sans toucher au token account

**Gestion des erreurs**
- `ProfileCreatePage` et `ProfileManagePage` interceptent les 409 de l'API (limite max, dernier profil, profil actif) avec messages utilisateur explicites
- En cas d'échec de `selectProfile`, le profil courant reste inchangé (le contexte gère via le catch dans `ProfileSwitcherPopover`)
- État de retry sur WhoIsWatchingScreen côté TV

---

## Problèmes détectés

### [BLOQUANT] Test requis manquant : switch pendant un progrès actif

Le ticket liste explicitement dans la section **§Tests** :

> `switch while progress exists saves outgoing profile and does not leak to incoming profile`

Ce cas de test n'est pas implémenté. Le test API existant (`Watch progress is profile-scoped`) vérifie uniquement que le progrès est stocké sous le bon `profileId` au niveau service — il ne teste pas le comportement lors d'un switch de profil avec du progrès en cours.

L'architecture est safe en pratique (le `PlayerPage` est hors AppShell, donc le switcher est inaccessible depuis le player), mais :
1. Le test est explicitement requis par le ticket
2. La propriété de non-fuite n'est pas couverte de façon automatisée
3. Le comportement "save outgoing progress before switch" n'est pas testé ni documenté comme intentionnellement absent

**Correction attendue** : ajouter un test `ProfileContext.test.tsx` ou `useProgressSync.test.ts` qui simule un switch de profil avec un progrès en cours et vérifie que (a) la progression est sauvegardée pour le profil sortant avant le changement de JWT et (b) la progression n'est pas attribuée au profil entrant.

Note : si l'approche retenue est que le PlayerPage étant hors switcher suffit comme garantie, cela doit être explicitement documenté dans un test (ex. vérifier que le switcher n'est pas accessible depuis `/player/*`).

---

### [MINEUR] `ProfileManagePage` : bouton "+ Ajouter" non désactivé à la limite `maxProfiles`

Le plan stipule : `"+ Ajouter un profil" button (disabled when at maxProfiles limit)`.

```tsx
// ProfileManagePage.tsx:49
<Button variant="secondary" onClick={() => navigate('/profiles/create')}>
  + Ajouter
</Button>
```

Le bouton est toujours actif. L'utilisateur qui a atteint la limite doit naviguer vers `/profiles/create`, remplir le formulaire, et soumettre pour voir le message d'erreur 409. Le ticket requiert de montrer la contrainte max proprement (`show max-profile constraint cleanly`).

Le `ProfileCreatePage` gère correctement le 409 avec `"Vous avez atteint le nombre maximum de profils."`, donc ce n'est pas un bug fonctionnel — mais c'est un écart avec le plan et une UX dégradée.

**Correction suggérée** : exposer le `maxProfiles` du compte (via `GET /profiles` qui pourrait retourner un header ou via un endpoint dédié), ou désactiver le bouton si `profiles.length >= MAX_PROFILES` (constante connue côté client).

---

### [MINEUR] `ProfileSettingsPage` ne dépend pas de `profileVersion`

```tsx
// ProfileSettingsPage.tsx:231
useEffect(() => {
  Promise.all([getProfile(), listSources()])
    .then(...)
}, []) // pas de profileVersion
```

Si l'utilisateur navigue manuellement vers `/settings/playback` après un switch sans passer par `/`, les préférences de l'ancien profil sont affichées jusqu'au prochain rechargement. Mitigé par le fait que `ProfileSwitcherPopover.handleSelect` appelle `navigate('/', { replace: true })`, mais pas garanti si l'utilisateur utilise l'historique du navigateur.

---

## Risques éventuels

**Android TV build non vérifié** : le rapport d'implémentation indique que la compilation Android TV échoue (SDK absent). La correction structurelle du `ProfileViewModelTest` est vérifiée, mais le build natif n'a pas été exécuté. Ce risque est signalé comme pré-existant à T099, mais il faut confirmer que les fichiers Kotlin sont syntaxiquement corrects avant merge (un CI avec Android SDK devrait le valider).

**Validation manuelle non documentée** : le ticket exige une validation manuelle bloquante avec 3 profils (A, B, C) sur Web et Android TV. L'implémentation-output confirme les tests automatisés mais ne contient pas de rapport de validation manuelle. Cette validation doit être effectuée avant fermeture du ticket.

---

## Décision

IMPLEMENTATION_FIX_REQUIRED

## Actions demandées

1. **[Bloquant]** Ajouter le test "switch while progress exists saves outgoing profile and does not leak to incoming profile" — soit en testant le comportement de `useProgressSync` lors d'un changement de `profileVersion`, soit en testant que `flushProgress()` est appelé avant le changement de JWT, soit en documentant explicitement via un test que le PlayerPage est architecturalement isolé du switcher.

2. **[Mineur]** Désactiver le bouton "+ Ajouter" dans `ProfileManagePage` quand `profiles.length` atteint la limite max, ou afficher un message de contrainte proactif. Nécessite d'exposer `maxProfiles` côté client (une option simple : ajouter un champ `maxProfiles: number` dans la réponse de `GET /profiles`).

3. **[Optionnel]** Ajouter `profileVersion` (ou un sélecteur de `currentProfile?.id`) dans les deps de l'`useEffect` de `ProfileSettingsPage`.

IMPLEMENTATION_FIX_REQUIRED
