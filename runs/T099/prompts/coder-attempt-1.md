# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T099 — Add profile selector and profile-management UX on Web/Mobile and Android TV

**Source**: GitHub Issue #202

## Description

## Context
After the Account -> Profile foundation (#201), IPTVFlix needs a polished profile-selection UX inspired by the familiar streaming-app pattern shown in the user reference screenshots.

The account authenticates once. Profiles are then selected/switched independently without logging the household account out.

This ticket is the USER EXPERIENCE layer for Web/Mobile and Android TV. Reuse #201 APIs/session semantics; do not invent a competing profile store.

## Product behavior summary

### Web / Mobile
- after login, use the last selected profile when available;
- show current profile avatar + name in the top/account area;
- tapping/clicking the profile opens a profile panel/sheet;
- user can switch profile instantly;
- include `Gérer les profils`, Account/Settings entry points and Logout;
- changing profile refreshes personalized Home/Continue Watching/My List/recommendations/preferences.

### Android TV
On real app launch / cold start, after account authentication, show a dedicated `Qui regarde ?` screen BEFORE Home:

```text
               Qui regarde ?

    [avatar]      [avatar]      [avatar]
     Pierre        Adèle          Léo

                [+ Ajouter]
```

User selects a profile with the remote, then enters that profile's personalized Home.

The TV UI must also provide a way to switch profiles later without logging out.

## 1. Shared profile design system
Create a reusable profile presentation model/component concept across clients:
- avatar;
- display name;
- active/current indication;
- kids indicator when relevant;
- edit affordance in manage mode.

Do not expose profile UUIDs in normal UI.

## 2. Avatar system
Provide a built-in IPTVFlix avatar gallery for v1.

Requirements:
- several visually distinct avatar choices;
- stable `avatarKey` values persisted on Profile;
- client maps `avatarKey` to bundled/server-served asset;
- graceful fallback avatar if key unknown/missing;
- architecture can support uploaded/custom avatars later without schema redesign.

Do not copy copyrighted Netflix avatar artwork.

## 3. Web/Desktop profile switcher
Add current profile affordance to the existing top navigation/account area.

Interaction:
- click avatar/name;
- show profile switcher popover/modal appropriate to desktop;
- current profile visually clear;
- all other profiles selectable;
- selecting one calls the #201 switch/select API/session action;
- close menu and refresh/invalidate all profile-scoped client data.

At minimum refresh/invalidate:
- Home shelves;
- Continue Watching;
- My List;
- watch history/progress;
- current media progress/resume state;
- recommendations;
- profile preferences;
- likes/dislikes;
- search personalization if applicable.

Avoid requiring a full logout/login.

## 4. Mobile profile panel
Implement a touch-friendly panel/sheet inspired by the reference UX:
- current profile prominently displayed;
- other profile avatars below/in a row/grid;
- `Gérer les profils` action;
- application settings/account entries where existing navigation supports them;
- logout remains Account-level, clearly distinct from profile switching.

A profile switch should feel immediate and should not leave stale content from the previous profile visible.

## 5. Android TV launch flow
After Account authentication is valid:

### Cold/startup behavior
Show `Qui regarde ?` before Home on each real app launch / TV startup session.

Do NOT require account password again merely to choose profile.

Remote interactions:
- D-pad left/right/up/down to navigate profiles;
- focused profile clearly enlarges/highlights;
- OK/Enter selects;
- Back behavior is sensible and does not accidentally log out;
- profile grid works at TV viewing distance.

After select:
- set current profile securely through #201;
- load only that profile's personalized Home and progress;
- proceed to normal TV app navigation.

## 6. Android TV in-app switch
Expose profile avatar/name somewhere in the TV navigation/account UI.

Selecting `Changer de profil` returns to the profile chooser without destroying account authentication.

Playback should be stopped/saved safely before switching profiles if a switch is initiated while media context exists.

## 7. Last-used profile semantics
Web/mobile may remember and directly restore the last selected profile for convenience.

Android TV should still show the profile chooser on a new app launch as requested, even if a last-used profile exists. The last-used profile can be pre-focused, but selection should remain explicit.

Persist last-used metadata at Account/device level where appropriate, not as a source of authorization by itself.

## 8. Profile management UX
Provide `Gérer les profils`:
- create profile;
- edit name;
- change avatar;
- toggle Kids profile / maturity-related basic option if #201 exposes it;
- delete profile with confirmation and #201 lifecycle constraints;
- show max-profile constraint cleanly.

Do not delete the active/last profile without following backend rules.

## 9. Create-profile UX
Simple form:
- name required;
- avatar choice;
- optional Kids toggle;
- create;
- on success either return to profile list or select the new profile according to platform UX.

Validation errors must be user-friendly.

## 10. Edit-profile UX
Edit mode should clearly differ from normal selection mode.

Normal tap = switch/select.
Manage/edit mode = edit that profile.

Avoid accidental switching while the user is trying to edit.

## 11. Account vs Profile settings boundary
UI wording must make this distinction obvious.

### Profile-level
Examples:
- avatar/name;
- preferred audio/subtitles;
- autoplay/skip intro/recap;
- never-stop mode;
- Kids/maturity;
- personal recommendations/list/history.

### Account-level
Examples:
- login/password/security;
- configured Xtream/M3U/Plex sources;
- shared app/device settings;
- logout.

Do not place household source credentials inside profile editing.

## 12. Profile switch cache invalidation
This is critical.

A profile switch must clear/invalidate stale profile-specific React/native state so one profile never briefly sees another profile's:
- Continue Watching;
- My List;
- history;
- progress;
- personalized shelves;
- likes/dislikes;
- preferences.

Shared catalog metadata/images may remain cached.

## 13. Deep-link / playback safety
If the user switches profile while a detail/player route is open:
- save outgoing profile progress first when relevant;
- do not transfer the active resume position to incoming profile;
- safest default is return to incoming profile Home after switch unless route semantics are proven safe.

Android TV Send-to-TV commands must execute under the currently selected TV profile or an explicitly requested profile context; do not silently attribute progress to the wrong profile.

## 14. Offline/error handling
If profile list cannot load:
- show retry/error state, not blank screen;
- do not invent a local profile that may diverge from server;
- preserve authenticated Account session.

If switch fails, remain on previous profile and show recoverable feedback.

## 15. Accessibility
Web/mobile:
- accessible profile buttons/labels;
- keyboard support desktop;
- modal/sheet focus management.

Android TV:
- visible D-pad focus;
- large text/avatar targets;
- TalkBack-friendly labels where feasible.

## Tests
Add coverage for:
- account with 1, 2 and max profiles;
- select profile;
- switch profile without logout;
- stale profile data invalidated;
- create/edit/delete profile;
- Kids profile indicator;
- last-used profile on Web/mobile;
- Android TV launch chooser shown;
- Android TV D-pad selection;
- switch from TV app back to chooser;
- switch while progress exists saves outgoing profile and does not leak to incoming profile;
- API failure leaves current profile stable.

## Manual validation — blocking
Use one account with at least three profiles and create intentionally different state:
- Profile A: Movie X in Continue Watching + My List A;
- Profile B: different progress/My List;
- Profile C: empty/new profile.

Verify on Web/Mobile:
- switch A -> B -> C from profile UI;
- every personalized section changes correctly without logout;
- no stale A content remains on B/C.

Verify on Android TV:
- cold launch opens `Qui regarde ?`;
- navigate with remote;
- select A and see A's Home;
- switch to B in-app and see B's state;
- relaunch app and chooser appears again with last-used profile optionally pre-focused.

## Acceptance criteria
- [ ] Web/Desktop shows current avatar/name and allows profile switching.
- [ ] Mobile has a touch-friendly profile panel/sheet.
- [ ] Android TV shows `Qui regarde ?` before Home on app launch.
- [ ] Android TV chooser is fully remote/D-pad usable.
- [ ] Last-used profile can be restored on Web/mobile.
- [ ] Android TV still requires explicit profile selection per app launch as requested.
- [ ] Profile switching does not log out the Account.
- [ ] Home/Continue Watching/My List/progress/recommendations switch to the selected profile.
- [ ] No stale cross-profile personalized data is visible after switching.
- [ ] Profiles can be created/edited/deleted within #201 rules.
- [ ] Built-in avatar gallery exists with stable avatar keys.
- [ ] Account settings remain distinct from Profile settings.
- [ ] Playback/progress is attributed to the correct active profile.
- [ ] Real Web/Mobile and Android TV flows are manually validated.

## Completion rule
Do not close because a selector component renders. Demonstrate a real account with multiple profiles on both Web/Mobile and Android TV, including cold-start TV profile selection and switching between profiles with visibly different Continue Watching/My List/progress state.