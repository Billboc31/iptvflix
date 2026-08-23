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


# T121 — Preserve semantic intent during SCORE_MODEL_V2 personalized reranking

**Source**: GitHub Issue #258

## Description

## Contexte

Le retrieval sémantique fonctionne maintenant correctement en production après #256/#257 :

- `Aventures à travers le temps` : **37 semanticRetrieved**, 37 post-filter, **0 fallback**, 20 final.
- autre shelf de type action/aventure : **40 semanticRetrieved**, 40 post-filter, **0 fallback**, 20 final.

Le problème restant est qualitatif : **le reranking personnalisé SCORE_MODEL_V2 semble pouvoir écraser trop fortement l’intention sémantique de la shelf**.

Principe produit attendu :

> **Le retrieval décide de quoi parle la shelf.**  
> **La personnalisation décide quels contenus pertinents pour cette shelf le profil préfère.**

La personnalisation ne doit pas transformer une shelf thématique en simple liste générale des contenus préférés du profil.

---

## Cas réel 1 — `Aventures à travers le temps`

### Raw Vector
Le retrieval sémantique est désormais cohérent et retourne notamment :

- `The Time Thief`
- `Chronovisor`
- `Time Lapse`
- `House of Time`
- `The Time Machine`
- `Timescape: Back to the Dinosaurs`
- `The Visitor from the Future`

avec 37 candidats sémantiques et aucun fallback.

### Final personnalisé
Le reranker remonte correctement plusieurs contenus temporels :

1. `Time Trap`
2. `The Time Travelers`
3. `The Time Machine`
4. `Timescape: Back to the Dinosaurs`
5. `The Visitor from the Future`

mais fait aussi remonter des contenus plus faibles vis-à-vis de l’intention, par exemple :

- `The Hobbit: An Unexpected Journey` #6
- `Journey to the Center of the Earth` #11
- `The Adventures of Tintin` #15
- `The Island of Thirty Coffins` #16
- `The Island` #20

Les raisons visibles sont surtout :

- `strong adventure genre affinity`
- `preferred language`
- `preferred era`

et la contribution de la pertinence sémantique est peu ou pas visible dans les raisons finales.

---

## Cas réel 2 — shelf action / aventure

### Raw Vector
Exemples parmi les candidats sémantiques :

- `Expend4bles`
- `Fast X`
- `The Fate of the Furious`
- `Mission: Impossible - Fallout`
- `The Expendables`
- `Deadpool`
- `Mad Max: Fury Road`
- `Pacific Rim: Uprising`
- `The Avengers`
- `Dune`
- `Avengers: Infinity War`
- `Avatar`

40 candidats sémantiques, 0 fallback.

### Final personnalisé
Le reranker produit :

1. `Top Gun: Maverick`
2. `Dune`
3. `Avengers: Infinity War`
4. `Avengers: Endgame`
5. `Mutiny`
6. `Mission: Impossible - Fallout`
7. `Deadpool & Wolverine`
8. `Mad Max: Fury Road`
9. `Fast X`
10. `Expend4bles`
...

Le résultat n’est pas absurde, mais les raisons affichées restent principalement :

- `strong adventure genre affinity`
- `preferred language`
- `preferred era`
- parfois `strong science fiction genre affinity`

Cela suggère que les préférences profil peuvent peser davantage que l’intention spécifique de la shelf.

---

## Objectif

Faire en sorte que SCORE_MODEL_V2 **préserve fortement la pertinence sémantique du concept** tout en personnalisant le classement à l’intérieur du pool pertinent.

Le moteur doit éviter ce type de dérive :

```text
ShelfConcept précis
→ bons candidats sémantiques
→ reranking profil
→ liste générique de films aimés par le profil
```

et viser :

```text
ShelfConcept précis
→ bons candidats sémantiques
→ élimination / pénalisation des candidats trop faibles sémantiquement
→ personnalisation entre candidats réellement pertinents
→ final
```

---

## Travaux demandés

### 1. Audit du SCORE_MODEL_V2

Documenter la formule réelle et les poids actuels utilisés pour :

- semantic similarity ;
- genre affinity ;
- theme/keyword affinity ;
- people affinity ;
- franchise affinity ;
- language ;
- country ;
- decade/era ;
- media type ;
- availability ;
- popularity/quality prior ;
- watched/dislike/not-interested ;
- exposure/repetition/diversity.

Vérifier si `semanticSimilarity` est actuellement suffisamment dominante dans les shelves fondées sur un `semanticIntent`.

### 2. Introduire une protection de pertinence sémantique

Pour les recommandations issues d’un ShelfConcept / QueryPlan sémantique, ajouter une stratégie explicite telle que l’une de ces approches (ou meilleure si justifiée) :

- **semantic relevance floor** : exclure les candidats sous un seuil configurable ;
- **semantic gate** : empêcher un faible score semantic d’être compensé entièrement par les préférences profil ;
- **semantic weight floor** : poids minimal garanti de la pertinence sémantique dans le score final ;
- combinaison de ces approches.

Le seuil/poids doit être configurable/versionné, pas un magic number dispersé dans le code.

### 3. Différencier les usages

Ne pas imposer la même contrainte partout :

- ShelfConcept thématique précis → forte préservation de l’intention ;
- Home profil-only / broad discovery → davantage de liberté pour la personnalisation ;
- fallback/popularité → autre comportement adapté ;
- query utilisateur avec contrainte explicite → pertinence sémantique/hard constraints prioritaires.

Le comportement doit dépendre du type de plan/requête, pas être globalement rigide.

### 4. Score breakdown / raisons

Le Lab doit permettre de comprendre pourquoi un item est retenu.

Pour chaque résultat final en debug, exposer au minimum :

```text
semanticSimilarity
semanticContribution
profileGenreContribution
profileThemeContribution
peopleContribution
languageContribution
eraContribution
otherPositiveContributions
penalties
finalScore
```

Les reason codes doivent refléter la pertinence sémantique quand elle est déterminante, par ex. :

- `strong semantic match to time-travel intent`
- `strong profile adventure affinity`
- `preferred language`

et pas seulement les goûts du profil.

### 5. Éviter les faux positifs sauvé uniquement par le profil

Ajouter un test garantissant qu’un contenu :

- très apprécié par le profil,
- mais faiblement lié à l’intention,

ne peut pas dépasser plusieurs contenus nettement plus pertinents sémantiquement uniquement grâce à `genre/language/era`.

---

## Tests de non-régression obligatoires

### A. `Aventures à travers le temps`

Le final doit rester dominé par des contenus réellement liés au voyage temporel / temporalité / distorsion du temps.

Exemples attendus comme fortement pertinents lorsqu’ils existent dans le pool :

- `The Time Machine`
- `Timescape: Back to the Dinosaurs`
- `The Visitor from the Future`
- `Time Trap`
- `The Time Travelers`
- `Time Lapse`
- `House of Time`

Des contenus d’aventure sans lien temporel fort (`The Hobbit`, `Tintin`, etc.) ne doivent pas être propulsés très haut uniquement grâce au profil.

### B. Shelf action / aventure

Le reranking peut réordonner fortement selon le profil, mais doit conserver une cohérence évidente avec l’intention de la shelf.

### C. `SF qui fait réfléchir`

Tester qu’un blockbuster d’action apprécié du profil ne dépasse pas abusivement des œuvres plus cérébrales si son lien avec l’intention est faible.

### D. `film qui retourne le cerveau`

Même principe : la personnalisation ne doit pas réduire la shelf à des films génériques aimés du profil.

---

## Métriques / évaluation

Ajouter dans le Lab ou un rapport de benchmark :

- moyenne de `semanticSimilarity` des top 5 / top 10 / top 20 avant rerank ;
- moyenne après rerank ;
- nombre de candidats sous le semantic floor dans le final ;
- corrélation rang vectoriel vs rang final ;
- signal lorsque le reranker fait remonter un candidat de très loin malgré faible semantic score.

Le but n’est pas d’empêcher toute exploration, mais de rendre visible une dérive excessive.

---

## Acceptance criteria

- [ ] La formule/pondération V2 est auditée et documentée.
- [ ] Une protection explicite de pertinence sémantique existe pour les shelves thématiques.
- [ ] Le mécanisme est configurable/versionné.
- [ ] `semanticSimilarity` et sa contribution sont visibles dans le score breakdown.
- [ ] Les reasons expliquent à la fois intention + profil.
- [ ] Un candidat faiblement pertinent ne peut plus être sauvé uniquement par genre/langue/ère au détriment de candidats nettement plus pertinents.
- [ ] `Aventures à travers le temps` reste dominée par des contenus temporels après personnalisation.
- [ ] Les queries `SF qui fait réfléchir` et `film qui retourne le cerveau` restent fidèles à leur intention après reranking.
- [ ] Les usages profil-only / discovery restent libres d’être davantage personnalisés.
- [ ] Aucun retour au simple ranking vector-only : la personnalisation doit rester active.

## Completion rule

Ne pas fermer le ticket sur une simple modification de poids ou sur tests unitaires uniquement.

La fermeture nécessite une validation réelle dans Recommendation Lab sur plusieurs concepts, montrant :

```text
bon Raw Vector
→ reranking personnalisé
→ final toujours fidèle à l’intention
```

avec score breakdown démontrant explicitement la contribution sémantique et les contributions profil.

Le but n’est pas de rendre le final identique au Raw Vector, mais de garantir que **la personnalisation réordonne la pertinence, elle ne remplace pas l’intention**.