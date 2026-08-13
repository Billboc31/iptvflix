I have all I need to write the review. Let me produce it now.

---

# PR Review — T063: Restore source management and administration access in the new top-navigation UI

## Résumé

L'implémentation introduit un nouveau composant `SettingsMenu` qui remplace le lien direct ⚙️ → `/settings/playback` par un menu déroulant exposant Sources, Lecture et Appareils. Le scope est conforme au plan et au ticket. Les routes exposées existent toutes dans le routeur. Les tests unitaires couvrent les comportements critiques.

## Vérifications effectuées

- Lecture de `SettingsMenu.tsx`, `TopNav.tsx`, `AppShell.tsx`, `BottomNav.tsx`, `App.tsx`
- Vérification de l'existence des trois routes exposées (`/sources`, `/settings/playback`, `/settings/devices`) dans `App.tsx`
- Lecture de `SettingsMenu.test.tsx` (9 tests) et `TopNav.test.tsx` (10 tests dont 3 nouveaux)
- Vérification de la visibilité mobile (absence de classe `md:hidden` sur `<SettingsMenu />`)
- Vérification de la conformité au plan (`runs/T063/plan.md`)

## Points validés

- **Accès à `/sources` restauré** : le lien est visible et fonctionnel via le menu ⚙️, sur desktop et mobile. Aucune classe responsive ne masque le bouton sur mobile.
- **Navigation principale préservée** : `NAV_ITEMS` dans `TopNav` est inchangé (Accueil, Films, Séries, Ma Liste, Nouveautés). Sources n'y apparaît pas.
- **Zéro lien mort introduit** : les trois entrées du menu correspondent exactement à des routes déclarées dans `App.tsx` (lignes 48, 50, 51). L'absence de "Profil" est correctement justifiée (route inexistante).
- **Accessibilité de base** : `aria-label="Paramètres"`, `aria-haspopup="true"`, `aria-expanded` dynamique, `role="menu"`, `role="menuitem"` — toutes les attributions ARIA requises sont présentes.
- **Comportements de fermeture** : click extérieur (`mousedown` sur `document`), touche Escape, click sur un item, changement de route — tous testés.
- **Active state** : `NavLink` avec `isActive` highlight pour l'item courant.
- **Aucune régression T059** : `LeftNav` absent, top bar conserve son aspect streaming-first.
- **Cleanup des event listeners** : le `useEffect` retourne bien un cleanup `removeEventListener` pour éviter les fuites mémoire.
- **Scope contenu** : 4 fichiers modifiés/créés, aucun changement aux pages SourcesPage / ProfileSettingsPage / DeviceSettingsPage.

## Problèmes détectés

### Mineur — `aria-haspopup="true"` vs `"menu"`

**Fichier** : `SettingsMenu.tsx:46`

La valeur `"true"` est techniquement valide (elle était l'ancienne forme), mais la spec ARIA 1.1+ préconise `aria-haspopup="menu"` quand le popup a `role="menu"`. Les lecteurs d'écran modernes reconnaissent les deux. Non bloquant.

### Mineur — Gestion du focus à l'ouverture/fermeture du menu

**Fichier** : `SettingsMenu.tsx` (absence de focus management)

Lorsque le menu s'ouvre (via clavier : Tab jusqu'au bouton, puis Enter), le focus reste sur le bouton déclencheur — il n'est pas déplacé vers le premier `menuitem`. À la fermeture par Escape ou click extérieur, le focus n'est pas explicitement restitué au bouton.

Le ticket demande que "keyboard navigation must work for desktop interactive menu elements". Le menu est bien accessible au clavier via Tab une fois ouvert, et l'Escape fonctionne. Mais le comportement WAI-ARIA recommandé pour ce pattern est : focus sur le premier item à l'ouverture, restitution au bouton à la fermeture. Non bloquant pour une première itération, mais à corriger pour conformité complète.

### Observation — BottomNav pre-existing dead links (hors scope T063)

Le plan documente explicitement que les liens morts de `BottomNav` (`/library`, `/activity`, `/profile`) sont pré-existants et exclus du scope. Constaté, aligné avec le plan.

## Risques éventuels

- **z-index** : le dropdown est positionné `z-50`. Si d'autres éléments sur certaines pages ont un z-index supérieur (modals, hero overlays), le menu pourrait passer en dessous. À monitorer lors de tests visuels sur les pages concernées.
- **Mobile tap area** : le bouton ⚙️ a un padding `p-1` (taille cible ~26px). Les guidelines tactiles recommandent 44px minimum. Le ticket ne spécifie pas de taille minimale mais c'est à surveiller.

## Décision

L'implémentation est correcte, bornée au scope du ticket, et couvre tous les critères d'acceptation. Les deux problèmes mineurs identifiés (valeur `aria-haspopup` et focus management) n'empêchent pas la fonctionnalité d'être utilisable et n'introduisent pas de régression. Ils peuvent être adressés dans un ticket accessibilité dédié.

- **APPROVED**

## Actions demandées

Aucune action bloquante. À titre indicatif pour un ticket accessibilité futur :
1. Remplacer `aria-haspopup="true"` par `aria-haspopup="menu"` dans `SettingsMenu.tsx:46`
2. Ajouter `focus()` sur le premier `menuitem` à l'ouverture du menu (via `useRef` + `useEffect`)
3. Restituer le focus au bouton déclencheur lors de la fermeture par Escape

IMPLEMENTATION_APPROVED
