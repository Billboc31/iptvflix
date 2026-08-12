# PR Review — T033: Add source-priority controls to playback preferences UI

## Résumé

L'implémentation ajoute un composant `SourcePriorityInput` à `ProfileSettingsPage` permettant à l'utilisateur de voir, réordonner et supprimer des sources prioritaires, avec persistance via `PATCH /profile/preferences`. Le périmètre est strictement frontend, conformément au plan : le backend (`preferredSourceIds` en base, route, resolver) était déjà opérationnel avant cette PR.

Fichiers modifiés : `apps/web/src/pages/ProfileSettingsPage.tsx` et `apps/web/src/pages/ProfileSettingsPage.test.tsx` uniquement.

## Vérifications effectuées

- Lecture du plan et de l'output d'implémentation
- Lecture du composant `ProfileSettingsPage.tsx` (325 lignes) et des tests (185 lignes)
- Vérification du client API, des handlers de test globaux, du service backend et du resolver
- Rapport de sortie : 81/81 tests pass

## Points validés

**Respect du ticket :**
- Sources listées avec noms lisibles (pas les IDs bruts) ✓
- Réordonnancement ▲/▼, même pattern que `LanguageListInput` ✓
- Persistance via `preferredSourceIds` dans `PATCH /profile/preferences` ✓
- Le resolver backend utilise l'ordre sans logique côté frontend ✓
- IDs supprimés filtrés à l'affichage ET à la sauvegarde ✓
- 4 tests nouveaux : rendu des noms, réordonnancement, sauvegarde ordonnée, ID périmé ✓

**Compatibilité ascendante :** Le handler global `GET /api/sources` dans `handlers.ts` couvre les 3 tests pré-existants sans régression.

**Cohérence avec le plan :** Aucun fichier backend modifié, strictement conforme à la section "Excluded".

## Problèmes détectés

Aucun problème bloquant.

**Observations mineures :**
1. `moveUp`/`moveDown` opèrent sur `displayedIds` (filtrés), ce qui écarte les IDs périmés dès le réordonnancement, pas seulement à la sauvegarde. Comportement cohérent mais légèrement plus agressif que la spec — sans conséquence négative.
2. Le flux "ajout via dropdown + Ajouter" n'est pas testé. Non requis par le plan.

## Décision

**APPROVED** — Ticket respecté, plan suivi, 81/81 tests pass, aucune régression.

IMPLEMENTATION_APPROVED
