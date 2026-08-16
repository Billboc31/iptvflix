## Review — T083

**Verdict : IMPLEMENTATION_FIX_REQUIRED**

---

### Ce qui est correct

Les fixes core sont bien identifiés et minimaux :

- **`PreviewContext.tsx`** : la vraie cause du crash. L'initializer `useState` appelait `window.matchMedia(...)` en vérifiant seulement `typeof window !== 'undefined'` — pas `typeof window.matchMedia === 'function'`. En jsdom, `window` existe mais `matchMedia` n'est pas une fonction → crash synchrone → arbre React démonté → page blanche. Fix correct et minimal.
- **`ErrorBoundary.tsx`** + wrapping `App.tsx` : conforme au plan, implémentation standard.
- **`AuthContext.tsx`** : catch simplifié, comportement réel identique mais plus robuste.
- **`ProtectedRoute.tsx`** : spinner au lieu de `null`, correct.
- **`test/setup.ts`** + mocks : infrastructure test correcte.
- **Diagnostic** : commit responsable identifié (T076/PR #161), documentation complète.

---

### Problèmes bloquants

**1. `HeroSection.tsx` rewrité sans justification**

L'original sur `main` avait déjà `isPointerCoarse()` correctement guardée :
```ts
function isPointerCoarse() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: coarse)').matches
    : false
}
```
`HeroSection` n'était **pas le crash site**. Pourtant le composant a subi : ajout de `posterUrl`, layout dual mobile/desktop, changement de hauteur, restructuration des gradients, suppression de `onAddToList`, attributs accessibility, boutons mute text → emoji. Le ticket exige explicitement "the smallest correct fix" et "Do not perform an unrelated UI rewrite."

**2. Suppression de `isPointerCoarse()` = régression comportementale mobile**

Cette fonction empêchait intentionnellement l'autoplay vidéo sur les appareils tactiles. Son remplacement par un check `prefers-reduced-motion` active la preview vidéo sur mobile — changement de comportement non documenté et non justifié dans le scope du ticket.

**3. `useFeaturedMedia` + series-in-hero = nouvelle feature hors scope**

Nouveau hook faisant 2 appels API parallèles (films + séries), logique de sélection du meilleur media, navigation différenciée dans `HomePage`. C'est une feature d'enrichissement du hero — pas un fix de blank screen.

---

### Actions demandées

1. Reverter `HeroSection.tsx` — retirer le rewrite UI, conserver uniquement ce qui était réellement cassé (vérifier si quoi que ce soit l'était).
2. Restaurer `isPointerCoarse()` ou documenter + justifier explicitement la suppression du comportement mobile dans un scope séparé.
3. Retirer `useFeaturedMedia.ts` et reverter `HomePage.tsx` — déplacer la feature series-in-hero dans un ticket dédié.

---

IMPLEMENTATION_FIX_REQUIRED
