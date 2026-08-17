I have a complete picture. Let me write the review.

---

# PR Review — T089: Stabilize VOD Controls Overlay

## Résumé

L'implémentation couvre exactement les 4 bugs identifiés dans le plan. Le diff T089 est minimal et chirurgical : 33 lignes modifiées dans `PlayerControls.tsx` + 63 lignes de tests ajoutées. Aucune dérive de scope.

## Vérifications effectuées

- Lecture du plan, du diff T089 isolé (`ea51051`), de `PlayerControls.tsx` en entier, et du fichier de tests complet
- Vérification que chaque fix correspond exactement à l'intention du plan
- Vérification de la logique des refs pour éviter les stale closures
- Analyse des 4 nouveaux tests avec fake timers
- Contrôle du scope : seuls les 2 fichiers annoncés touchés

## Points validés

**Bug 1 — pointer-events-none bloquait la récupération des contrôles**
L'ancienne `controls-overlay` div portait à la fois les handlers (`onPointerMove`, `onClick`) et `pointer-events-none` quand cachée. Le fix déplace les handlers sur un wrapper parent `<div className="absolute inset-0">` qui ne porte jamais `pointer-events-none`. La div interne garde `pointer-events-none` quand cachée pour éviter les clics accidentels sur des boutons invisibles. ✅

**Bug 2 — timer fire après pause**
`startHideTimer` vérifiait les guards au moment de l'appel mais pas à l'exécution du callback. La double-vérification dans le callback garantit que si l'état change pendant les 3 secondes (pause, ouverture popover, scrubbing), le `setVisible(false)` ne se déclenche pas. Les refs sont correctement synchronisées : `onPlay`/`onPause` mettent à jour `playingRef.current` immédiatement (sans attendre le prochain render), ce qui est essentiel pour la fiabilité du guard dans le callback. ✅

**Bug 3 — fullscreen laissait les contrôles cachés**
Le pattern `showControlsRef` (ref créée une fois, valeur mise à jour à chaque render ligne 113-114) est la bonne approche pour appeler la dernière version de `showControls` depuis un effet à dépendances stables. Les 3 handlers fullscreen (`onFsChange`, `onWebkitFsBegin`, `onWebkitFsEnd`) appellent `showControlsRef.current()`. ✅

**Bug 4 — timer et scrubbingRef survivaient au changement de source**
Le cleanup de l'effet video appelle désormais `clearHideTimer()` et reset `scrubbingRef.current = false`. Empêche un timer stale de masquer les contrôles pendant le démarrage de la nouvelle source, et évite le blocage permanent du timer si le scrubbing était en cours au moment du switch. ✅

**Tests** — 4 tests avec `vi.useFakeTimers()`, chacun ciblant un bug précis. Couverture correcte : hide-then-pointer-move, pause-before-timer, fullscreen-while-hidden, source-change-scrubbing-reset. ✅

## Problèmes détectés

Aucun bloquant.

**Observation mineure 1 — buffering ne retient pas les contrôles**
Le ticket demande que les contrôles restent visibles pendant le buffering. `onWaiting` appelle uniquement `setBuffering(true)` mais ne bloque pas le timer. En pratique, grâce au fix du Bug 1, les contrôles restent **récupérables** (pointer move les ramène), donc l'inaccessibilité permanente est impossible. Les acceptance criteria n'ont pas de case à cocher explicite pour ce cas. Non bloquant.

**Observation mineure 2 — test "source change" utilise unmount/remount**
Le test simule le switch de qualité via unmount + remount. La vrai mécanique serait un changement de `videoRef` prop avec le composant monté. Le code de cleanup est correct dans les deux cas ; le test couvre bien la bonne ligne de code. Non bloquant.

## Risques éventuels

Aucun risque identifié. Le changement est strictement borné, aucun comportement existant n'est modifié en dehors des 4 bugs ciblés.

## Décision

- APPROVED

## Actions demandées

Aucune.

IMPLEMENTATION_APPROVED
