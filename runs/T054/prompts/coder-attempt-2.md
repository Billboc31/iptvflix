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


# T054 — Add Netflix-style autoplay previews on Home and catalog browsing

**Source**: GitHub Issue #103

## Description

## Objective

Add optional Netflix-style short autoplay previews while browsing Home/catalog/detail surfaces so users can quickly understand a Movie or Series without opening a separate trailer action first.

## Context / Problem

IPTVFlix now has recommendation-backed Shelves/Home and is adding rich detail pages with trailer metadata. The next UX step is lightweight preview playback similar to modern streaming apps: focus/hover/selection can transition a static hero/card into a muted trailer/teaser preview after a deliberate delay.

This must remain controlled, performant and non-annoying, especially on mobile and future TV clients.

## Included

- Reuse canonical trailer/video metadata introduced by the detail/trailer feature; do not perform YouTube searches directly from card components.
- Implement autoplay preview behavior for the Home hero and selected/high-intent catalog surfaces.
- On desktop, support delayed hover/focus preview where appropriate; on touch devices do not emulate hover and avoid surprise autoplay.
- Start previews muted by default and provide clear mute/unmute and replay/open-detail controls where relevant.
- Stop preview immediately when focus/hover/visibility moves away; never allow multiple simultaneous previews.
- Respect browser autoplay restrictions and fall back cleanly to static backdrop/poster when autoplay is denied.
- Respect `prefers-reduced-motion` and expose a user/profile setting to disable autoplay previews.
- Lazy-load/embed preview players only after user intent/delay to avoid loading many YouTube embeds across a Shelf.
- Use a privacy-conscious YouTube embed mode where practical.
- Ensure cards remain usable with keyboard navigation and that preview behavior does not trap focus.
- Define the preview component/API so the future Android TV client can use the same trailer metadata while implementing TV-native focus behavior separately.

## Acceptance Criteria

- [ ] Home hero can transition from backdrop to a muted trailer/teaser preview when a valid preview exists.
- [ ] Supported desktop card/focus interactions can start a preview only after a deliberate delay, not immediately on incidental pointer movement.
- [ ] Only one preview can play at a time and it stops when the item is no longer active/visible.
- [ ] No trailer metadata means the normal static card/hero remains unchanged.
- [ ] Browser autoplay failure does not produce a broken/blank card.
- [ ] Users can disable autoplay previews and reduced-motion preferences are respected.
- [ ] Touch/mobile behavior avoids unwanted automatic video playback.
- [ ] Loading is lazy/bounded; rendering a Shelf does not instantiate a video player for every item.
- [ ] Automated frontend tests cover preview availability, delay/cancel, single-active-player, autoplay-disabled and no-preview fallbacks.

## Excluded / Out of scope

- Generating custom preview clips from full IPTV video streams.
- Hosting/transcoding trailer media.
- Android TV-specific preview implementation.

## Dependencies

Depends on #102 (canonical trailer/video metadata and integrated trailer support). It can use the current Home/Shelf architecture and should remain independent of provider-specific availability.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tests pass:
- **API**: 35 test files, 507 tests
- **Web**: 20 test files, 125 tests

T054 is fully implemented. The complete feature covers:
- `trailerKey` plumbed through all API routes (catalog, shelves, home)
- `autoplayPreviews` DB column + migration + profile preference UI toggle
- `PreviewContext` + `PreviewPlayer` components (YouTube-nocookie, muted autoplay)
- Hero section 2s auto-preview, poster cards 1.5s hover/focus preview
- Touch device detection and `prefers-reduced-motion` guard
- Single-active-player constraint via shared context
- All pre-existing tests still pass (no regressions)

---

## Review

Now I have enough to write a complete, structured review.

---

## PR Review — T054: Netflix-style autoplay previews

### Résumé

L'implémentation couvre l'essentiel du ticket : contexte partagé pour le preview unique, embedding YouTube-nocookie muted, délais intentionnels avant déclenchement, détection touch/pointer, respect `prefers-reduced-motion`, préférence utilisateur en base + API + UI, tests unitaires des scénarios clés. La structure générale est saine.

Plusieurs problèmes concrets requièrent des corrections avant merge : un bug de fuite de timer dans `PosterCard`, un risque de piège clavier sur l'iframe, et une exigence manquante du ticket (contrôle mute/unmute).

---

### Vérifications effectuées

- Lecture de tous les fichiers créés/modifiés : `PreviewContext.tsx`, `PreviewPlayer.tsx`, `PosterCard.tsx`, `HeroSection.tsx`, `ProfileSettingsPage.tsx`, `App.tsx`, migration SQL, contrats API, suites de tests.
- Vérification de chaque critère d'acceptation du ticket.
- Analyse du flow activation/désactivation et des cas limites.

---

### Points validés

- **Preview unique garanti** : le contexte partagé (`PreviewContext`) impose un seul `activeId` global. Activer un second preview remplace le premier. ✓
- **Lazy mounting** : `PreviewPlayer` retourne `null` quand `active=false`. Aucun iframe n'est créé tant que l'utilisateur n'a pas déclenché l'intention. ✓
- **Délai intentionnel** : 1500 ms pour les cards, 2000 ms pour le hero — aucun déclenchement sur mouvement incidentel. ✓
- **Touch device** : `pointer: coarse` détecté dans les deux composants via `window.matchMedia`, cohérence correcte. ✓
- **prefers-reduced-motion** : vérifié dans `PreviewContext.activate()` avant tout déclenchement. ✓
- **Préférence utilisateur** : `autoplayPreviews` ajouté en base (migration `0021`), dans le contrat API, dans `ProfileSettingsPage`, fetchée au montage du provider. ✓
- **youtube-nocookie.com** : embed privacy-conscious confirmé dans `PreviewPlayer.tsx` ligne 20. ✓
- **Fallback autoplay browser** : le poster reste visible car l'iframe a `opacity: 0` jusqu'au chargement. ✓
- **Clavier — focus/blur** : `onFocus`/`onBlur` déclenchent/annulent le timer, `role="button"`, `tabIndex`, `onKeyDown` pour Enter. ✓
- **Données trailerKey** : propagées comme prop optionnelle sans rendering si null. ✓
- **Tests** : couverture des cas principaux (no-trailer, hover delay, cancel, touch, autoplayPreviews=false, reduced-motion, focus/blur). ✓

---

### Problèmes détectés

#### 🔴 Bloquant 1 — PosterCard : timer non nettoyé au démontage

**Fichier** : `apps/web/src/components/content/PosterCard.tsx`

Il n'y a aucun `useEffect` de cleanup. Si le composant est démonté (navigation, pagination) pendant que le timer de 1500 ms est en cours, le callback s'exécute après démontage et appelle `activate(mediaId, trailerKey)` sur le contexte parent encore monté. Cela laisse le contexte dans un état `activeId` orphelin : aucun `PreviewPlayer` visible ne rend le preview, et le contexte reste "occupé" jusqu'à ce qu'une interaction future appelle `deactivate()`.

Les tests de `PosterCard` ne couvrent pas ce scénario (démontage avec timer pending).

**Correction requise** :

```tsx
// dans PosterCard, ajouter après les déclarations de fonctions :
useEffect(() => {
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }
}, [])
```

---

#### 🔴 Bloquant 2 — PreviewPlayer : iframe accessible au clavier (risque piège clavier)

**Fichier** : `apps/web/src/components/content/PreviewPlayer.tsx`, ligne 23

L'`<iframe>` n'a pas `tabIndex={-1}`. Les iframes cross-origin (youtube-nocookie.com) peuvent ou non être dans l'ordre de tabulation selon le navigateur. Un utilisateur naviguant au clavier pourrait entrer dans l'embed YouTube et ne plus pouvoir en sortir (WCAG 2.1 Level A, critère 2.1.2 No Keyboard Trap). Le ticket exige explicitement que "preview behavior does not trap focus".

**Correction requise** :

```tsx
<iframe
  ref={iframeRef}
  tabIndex={-1}   // ← ajouter
  ...
/>
```

---

#### 🟡 Significatif 1 — Contrôle mute/unmute absent

Le ticket description dit explicitement : *"Start previews muted by default and provide clear mute/unmute and replay/open-detail controls where relevant."*

L'implémentation a `controls=0` sur l'iframe YouTube et n'expose aucun bouton mute/unmute personnalisé, ni dans `HeroSection` ni dans `PosterCard`. Les cards en petit format peuvent tolérer l'absence de contrôles, mais le hero (56vh) devrait exposer un toggle mute/unmute visible. C'est une exigence explicite du ticket description.

**Correction requise** : ajouter un bouton mute/unmute overlay dans `HeroSection` (au minimum), communiquant l'état via `postMessage` à l'iframe (API YouTube IFrame `player.mute()`/`player.unMute()`), ou en reconstruisant le src avec `mute=0` si on bascule.

---

#### 🟡 Significatif 2 — `reducedMotion` lue une seule fois, non réactive

**Fichier** : `apps/web/src/contexts/PreviewContext.tsx`, lignes 23–26

```tsx
const reducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
```

Cette valeur est capturée au moment du premier rendu du `PreviewProvider` et n'est jamais mise à jour. Si l'utilisateur modifie son paramètre système en cours de session (rare mais valide), l'état ne se mettra pas à jour.

**Correction suggérée** : utiliser un `useState` initialisé + un `useEffect` écoutant `matchMedia.addEventListener('change', ...)`.

---

#### 🟠 Mineur 1 — `deactivate()` appelé inconditionnellement dans HeroSection au démontage

**Fichier** : `apps/web/src/components/content/HeroSection.tsx`, ligne 40

Le cleanup du `useEffect` appelle `deactivate()` sans vérifier si le hero est actuellement actif (`isActive`). Si le timer n'a pas encore déclenché (preview pas encore actif), cela appelle quand même `deactivate()` inutilement. Dans un scénario où un PosterCard a un preview actif et que HeroSection démonte pour une raison externe, cela tuerait le preview de la card.

En pratique, HeroSection et les PosterCards coexistent sur la même route et démontent ensemble, donc l'impact réel est faible. Correction recommandée : `if (isActive) deactivate()` dans le cleanup.

---

#### 🟠 Mineur 2 — `activate`/`deactivate` non mémorisés

**Fichier** : `apps/web/src/contexts/PreviewContext.tsx`

Les fonctions `activate` et `deactivate` sont recréées à chaque rendu de `PreviewProvider`. Le `useEffect` de HeroSection (ligne 42) est obligé de supprimer l'avertissement eslint exhaustive-deps car inclure ces fonctions instables dans les dépendances créerait une boucle infinie. Avec `useCallback`, les dépendances pourraient être déclarées proprement.

---

### Risques éventuels

- **Autoplay browser denial** : le fallback poster-visible-par-transparence fonctionne, mais si le navigateur bloque l'autoplay et charge quand même l'iframe (ex: affiche un placeholder YouTube), l'utilisateur voit un overlay YouTube par-dessus le poster. Risk faible mais réel sur certains contextes restrictifs (CSP strict). Non bloquant.
- **Performance shelf** : `PreviewPlayer` est bien instancié conditionnellement (`{trailerKey && <PreviewPlayer ... active={isActive} />`), mais chaque card qui a un `trailerKey` monte le composant React (qui rend `null`). Sur une shelf de 50 éléments avec trailerKey, 50 composants React inactifs sont montés. Acceptable pour l'instant.

---

### Décision

L'implémentation est bien structurée et couvre la majorité des exigences, mais deux problèmes bloquants (fuite de timer au démontage, piège clavier) et une exigence explicite du ticket manquante (contrôle mute/unmute sur le hero) nécessitent correction.

### Actions demandées

1. **PosterCard** : ajouter `useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])` pour cleanup au démontage.
2. **PreviewPlayer** : ajouter `tabIndex={-1}` sur l'`<iframe>`.
3. **HeroSection** : ajouter un bouton mute/unmute overlay communiquant avec l'iframe YouTube via `postMessage` / YouTube IFrame API.
4. (Recommandé) **PreviewContext** : rendre `reducedMotion` réactif via `addEventListener('change', ...)`.
5. (Recommandé) **HeroSection cleanup** : conditionner `deactivate()` à `isActive` dans le cleanup.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T054/reviews/implementation-review.md
- generated at: 2026-08-12T23:57:18Z

---

Now I have enough to write a complete, structured review.

---

## PR Review — T054: Netflix-style autoplay previews

### Résumé

L'implémentation couvre l'essentiel du ticket : contexte partagé pour le preview unique, embedding YouTube-nocookie muted, délais intentionnels avant déclenchement, détection touch/pointer, respect `prefers-reduced-motion`, préférence utilisateur en base + API + UI, tests unitaires des scénarios clés. La structure générale est saine.

Plusieurs problèmes concrets requièrent des corrections avant merge : un bug de fuite de timer dans `PosterCard`, un risque de piège clavier sur l'iframe, et une exigence manquante du ticket (contrôle mute/unmute).

---

### Vérifications effectuées

- Lecture de tous les fichiers créés/modifiés : `PreviewContext.tsx`, `PreviewPlayer.tsx`, `PosterCard.tsx`, `HeroSection.tsx`, `ProfileSettingsPage.tsx`, `App.tsx`, migration SQL, contrats API, suites de tests.
- Vérification de chaque critère d'acceptation du ticket.
- Analyse du flow activation/désactivation et des cas limites.

---

### Points validés

- **Preview unique garanti** : le contexte partagé (`PreviewContext`) impose un seul `activeId` global. Activer un second preview remplace le premier. ✓
- **Lazy mounting** : `PreviewPlayer` retourne `null` quand `active=false`. Aucun iframe n'est créé tant que l'utilisateur n'a pas déclenché l'intention. ✓
- **Délai intentionnel** : 1500 ms pour les cards, 2000 ms pour le hero — aucun déclenchement sur mouvement incidentel. ✓
- **Touch device** : `pointer: coarse` détecté dans les deux composants via `window.matchMedia`, cohérence correcte. ✓
- **prefers-reduced-motion** : vérifié dans `PreviewContext.activate()` avant tout déclenchement. ✓
- **Préférence utilisateur** : `autoplayPreviews` ajouté en base (migration `0021`), dans le contrat API, dans `ProfileSettingsPage`, fetchée au montage du provider. ✓
- **youtube-nocookie.com** : embed privacy-conscious confirmé dans `PreviewPlayer.tsx` ligne 20. ✓
- **Fallback autoplay browser** : le poster reste visible car l'iframe a `opacity: 0` jusqu'au chargement. ✓
- **Clavier — focus/blur** : `onFocus`/`onBlur` déclenchent/annulent le timer, `role="button"`, `tabIndex`, `onKeyDown` pour Enter. ✓
- **Données trailerKey** : propagées comme prop optionnelle sans rendering si null. ✓
- **Tests** : couverture des cas principaux (no-trailer, hover delay, cancel, touch, autoplayPreviews=false, reduced-motion, focus/blur). ✓

---

### Problèmes détectés

#### 🔴 Bloquant 1 — PosterCard : timer non nettoyé au démontage

**Fichier** : `apps/web/src/components/content/PosterCard.tsx`

Il n'y a aucun `useEffect` de cleanup. Si le composant est démonté (navigation, pagination) pendant que le timer de 1500 ms est en cours, le callback s'exécute après démontage et appelle `activate(mediaId, trailerKey)` sur le contexte parent encore monté. Cela laisse le contexte dans un état `activeId` orphelin : aucun `PreviewPlayer` visible ne rend le preview, et le contexte reste "occupé" jusqu'à ce qu'une interaction future appelle `deactivate()`.

Les tests de `PosterCard` ne couvrent pas ce scénario (démontage avec timer pending).

**Correction requise** :

```tsx
// dans PosterCard, ajouter après les déclarations de fonctions :
useEffect(() => {
  return () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }
}, [])
```

---

#### 🔴 Bloquant 2 — PreviewPlayer : iframe accessible au clavier (risque piège clavier)

**Fichier** : `apps/web/src/components/content/PreviewPlayer.tsx`, ligne 23

L'`<iframe>` n'a pas `tabIndex={-1}`. Les iframes cross-origin (youtube-nocookie.com) peuvent ou non être dans l'ordre de tabulation selon le navigateur. Un utilisateur naviguant au clavier pourrait entrer dans l'embed YouTube et ne plus pouvoir en sortir (WCAG 2.1 Level A, critère 2.1.2 No Keyboard Trap). Le ticket exige explicitement que "preview behavior does not trap focus".

**Correction requise** :

```tsx
<iframe
  ref={iframeRef}
  tabIndex={-1}   // ← ajouter
  ...
/>
```

---

#### 🟡 Significatif 1 — Contrôle mute/unmute absent

Le ticket description dit explicitement : *"Start previews muted by default and provide clear mute/unmute and replay/open-detail controls where relevant."*

L'implémentation a `controls=0` sur l'iframe YouTube et n'expose aucun bouton mute/unmute personnalisé, ni dans `HeroSection` ni dans `PosterCard`. Les cards en petit format peuvent tolérer l'absence de contrôles, mais le hero (56vh) devrait exposer un toggle mute/unmute visible. C'est une exigence explicite du ticket description.

**Correction requise** : ajouter un bouton mute/unmute overlay dans `HeroSection` (au minimum), communiquant l'état via `postMessage` à l'iframe (API YouTube IFrame `player.mute()`/`player.unMute()`), ou en reconstruisant le src avec `mute=0` si on bascule.

---

#### 🟡 Significatif 2 — `reducedMotion` lue une seule fois, non réactive

**Fichier** : `apps/web/src/contexts/PreviewContext.tsx`, lignes 23–26

```tsx
const reducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
```

Cette valeur est capturée au moment du premier rendu du `PreviewProvider` et n'est jamais mise à jour. Si l'utilisateur modifie son paramètre système en cours de session (rare mais valide), l'état ne se mettra pas à jour.

**Correction suggérée** : utiliser un `useState` initialisé + un `useEffect` écoutant `matchMedia.addEventListener('change', ...)`.

---

#### 🟠 Mineur 1 — `deactivate()` appelé inconditionnellement dans HeroSection au démontage

**Fichier** : `apps/web/src/components/content/HeroSection.tsx`, ligne 40

Le cleanup du `useEffect` appelle `deactivate()` sans vérifier si le hero est actuellement actif (`isActive`). Si le timer n'a pas encore déclenché (preview pas encore actif), cela appelle quand même `deactivate()` inutilement. Dans un scénario où un PosterCard a un preview actif et que HeroSection démonte pour une raison externe, cela tuerait le preview de la card.

En pratique, HeroSection et les PosterCards coexistent sur la même route et démontent ensemble, donc l'impact réel est faible. Correction recommandée : `if (isActive) deactivate()` dans le cleanup.

---

#### 🟠 Mineur 2 — `activate`/`deactivate` non mémorisés

**Fichier** : `apps/web/src/contexts/PreviewContext.tsx`

Les fonctions `activate` et `deactivate` sont recréées à chaque rendu de `PreviewProvider`. Le `useEffect` de HeroSection (ligne 42) est obligé de supprimer l'avertissement eslint exhaustive-deps car inclure ces fonctions instables dans les dépendances créerait une boucle infinie. Avec `useCallback`, les dépendances pourraient être déclarées proprement.

---

### Risques éventuels

- **Autoplay browser denial** : le fallback poster-visible-par-transparence fonctionne, mais si le navigateur bloque l'autoplay et charge quand même l'iframe (ex: affiche un placeholder YouTube), l'utilisateur voit un overlay YouTube par-dessus le poster. Risk faible mais réel sur certains contextes restrictifs (CSP strict). Non bloquant.
- **Performance shelf** : `PreviewPlayer` est bien instancié conditionnellement (`{trailerKey && <PreviewPlayer ... active={isActive} />`), mais chaque card qui a un `trailerKey` monte le composant React (qui rend `null`). Sur une shelf de 50 éléments avec trailerKey, 50 composants React inactifs sont montés. Acceptable pour l'instant.

---

### Décision

L'implémentation est bien structurée et couvre la majorité des exigences, mais deux problèmes bloquants (fuite de timer au démontage, piège clavier) et une exigence explicite du ticket manquante (contrôle mute/unmute sur le hero) nécessitent correction.

### Actions demandées

1. **PosterCard** : ajouter `useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])` pour cleanup au démontage.
2. **PreviewPlayer** : ajouter `tabIndex={-1}` sur l'`<iframe>`.
3. **HeroSection** : ajouter un bouton mute/unmute overlay communiquant avec l'iframe YouTube via `postMessage` / YouTube IFrame API.
4. (Recommandé) **PreviewContext** : rendre `reducedMotion` réactif via `addEventListener('change', ...)`.
5. (Recommandé) **HeroSection cleanup** : conditionner `deactivate()` à `isActive` dans le cleanup.

IMPLEMENTATION_FIX_REQUIRED