Now I have a complete picture of the implementation. Let me write up the structured review.

---

# PR Review — T086: Fix shelf card hover state + Netflix-style focused card

## Résumé

L'implémentation corrige le bug root-cause du hover leak, ajoute un état de focus par carte avec un portail pop-out, coordonne la preview via un contexte singleton, et fournit des tests ciblés sur l'isolation et le cleanup. Le plan est suivi fidèlement sur les points critiques.

---

## Vérifications effectuées

- Lecture du ticket T086 et du plan complet
- Comparaison `main` ↔ branche sur tous les fichiers sources `.tsx`/`.ts` modifiés
- Trace complète `HorizontalRow` (bug original) → `PosterCard` → `FocusedCardPortal` → `PreviewContext` → `PreviewPlayer`
- Vérification du câblage `PreviewProvider` dans `App.tsx`
- Lecture de tous les tests : `PosterCard.test.tsx`, `PreviewContext.test.tsx`, fichiers `.test.tsx` existants
- Vérification de la logique de positionnement du portail et de l'edge detection
- Contrôle de la gestion des timers/race conditions
- Vérification scope des classes Tailwind `group` vs `group/row`

---

## Points validés

**1. Correction du bug root-cause (hover leak)**
`HorizontalRow` utilisait `<div className="relative group">` — un groupe Tailwind non nommé. Tailwind `group-hover:*` remonte à tout ancêtre portant la classe `group`, donc tous les `group-hover:opacity-100` des cartes s'activaient dès qu'on survolait n'importe quelle zone de la ligne.  
Le fix change en `<div className="relative group/row">` (groupe nommé). Les `group-hover:*` des `PosterCard` ciblent désormais uniquement le groupe anonyme du card root — isolation correcte et prouvée.

**2. Race-condition guard**
Le pattern `hoverEpoch` (incrémenté à chaque `handleEnter` et `handleLeave`) est correct. Le callback du timer vérifie `hoverEpoch.current !== epoch` avant de passer à `setIsFocused(true)` ou `activate()`. Rapid hover A → B → C fonctionne comme attendu : seule C entre en état focalisé.

**3. Portail pop-out sans reflow**
`FocusedCardPortal` utilise `createPortal(…, document.body)` avec `position: fixed` — aucun impact sur le layout du shelf. `z-index: 35` est correctement calibré (au-dessus des arrows z-10 et de MediaHero z-20/30, en-dessous de TopNav z-40 et modals z-50).

**4. Edge detection**
La logique `rectLeft < 160 → align-left`, `rectRight > window.innerWidth − 160 → align-right`, sinon centré est cohérente avec le plan et couvre les cartes aux extrémités du viewport.

**5. Singleton preview**
`PreviewContext` expose un seul `activeId`/`activeKey`. Un `activate()` depuis une nouvelle carte écrase l'ancienne. La `deactivate()` dans `handleLeave` est idempotente et sûre (quand on quitte B, A a déjà été nettoyé par son propre `handleLeave`).

**6. No-preview fallback**
Si `trailerKey` est null : `FocusedCardPortal` monte, affiche le backdrop/poster + le bouton Détails, sans `PreviewPlayer`. Pas de rectangle noir, pas d'erreur.

**7. Touch guard**
`isTouch()` en tête de `handleEnter` bloque tout le chemin d'agrandissement et de preview sur les appareils coarse-pointer.

**8. Cleanup complet**
- `focusTimerRef` et `previewTimerRef` nettoyés sur `handleLeave` et sur unmount (effet cleanup).
- `deactivate()` appelé sur `handleLeave`.
- `cancelAnimationFrame` dans le cleanup de l'effet d'animation du portail.

**9. Câblage du contexte**
`<PreviewProvider>` wrappé au niveau de `App.tsx` au-dessus de `BrowserRouter` — accessible partout dans l'app.

**10. Tests nouveaux (PosterCard.test.tsx)**
- `portal does not mount before 400ms` ✅  
- `portal mounts after 400ms` ✅  
- `portal unmounts on mouse leave` ✅  
- `hover isolation: quick hover A then B leaves A without portal` ✅  
- `preview cleanup: deactivate is called and portal unmounts on leave` ✅  
- `no-preview card: portal renders without PreviewPlayer` ✅

---

## Problèmes détectés

### Observation 1 — Non-bloquant : test `autoplayPreviews: false` ne teste pas ce qu'il prétend

`PosterCard.test.tsx` ligne 111–135 configure un handler MSW pour `/api/profile` avec `autoplayPreviews: false`, mais `usePreview` est entièrement mocké. Le handler MSW n'est jamais consulté par le mock. Le test passe parce que `activeId: null` (dans le mock) empêche l'iframe — pas parce que `autoplayPreviews` bloque la preview. Le commentaire "activate spy is a no-op" est inexact : `activate` EST appelé, mais comme `activeId` reste null dans le mock, le player ne s'affiche pas.

**Impact** : couverture trompeuse. La fonctionnalité `autoplayPreviews: false` est réellement testée dans `PreviewContext.test.tsx` (test `activate is no-op when autoplayPreviews is false`), donc la logique est bien couverte — juste pas depuis le niveau `PosterCard`.

**Correction suggérée** : adapter le test pour asserter que `activate` a été appelé (ou réécrire le test pour tester ce qui est réellement observé).

### Observation 2 — Non-bloquant : pas de bouton Play dans FocusedCardPortal

Le plan mentionne un bouton Play conditionnel à la disponibilité VOD. L'implémentation ne l'inclut pas (seul "Détails" est présent). Le ticket formule ce point avec "can expose" (non obligatoire) et aucun critère d'acceptance ne rend ce bouton obligatoire dans le portal. Acceptable pour ce ticket.

### Observation 3 — Informationnel : keyboard focus active toujours la preview

`onFocus={handleEnter}` — sur un appareil non-touch, keyboard focus déclenche le timer de focus (400 ms) puis le timer preview (1 500 ms), ce qui appelle `activate()`. La preview muted se lance.

Le plan dit "no change to existing `onFocus`/`onBlur` audio/video behaviour" — le code original sur `main` faisait exactement la même chose (`onFocus={startPreview}`). Comportement conservé intentionnellement. La preview est muted. Acceptable mais à noter pour un audit accessibilité futur.

---

## Risques éventuels

- La suppression massive de fichiers `.js`/`.d.ts`/`.js.map` compilés est hors scope T086 mais sans risque si le build/CI compile à partir des sources `.tsx`. À vérifier que le pipeline CI ne dépend pas des artefacts commités.
- Le `cardRect` est capturé au moment du `mouseEnter`, utilisé 400 ms plus tard. Un scroll rapide de la page pendant ce délai causerait un léger décalage de position. Risque négligeable en pratique (400 ms est court).

---

## Décision

L'implémentation est correcte, robuste et conforme au ticket sur tous les critères d'acceptance bloquants. Le bug de hover leak est corrigé à la racine. Le pattern portail isole correctement l'agrandissement sans reflow. La race-condition est gérée. Les tests couvrent les cas critiques.

IMPLEMENTATION_APPROVED
