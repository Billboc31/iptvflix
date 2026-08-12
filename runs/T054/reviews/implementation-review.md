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
