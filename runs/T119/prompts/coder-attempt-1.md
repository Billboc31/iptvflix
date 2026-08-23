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


# T119 — Fix semantic retrieval returning 0 candidates in ShelfConcept preview

**Source**: GitHub Issue #254

## Description

## Contexte

Après les corrections #248, #250 et #252, la preview `Raw vector / Final personnalisé` fonctionne maintenant en production et permet enfin d’observer le pipeline réel.

Sur le ShelfConcept **`Aventures à travers le temps`**, la preview montre actuellement :

- `RAW VECTOR`
- **`Candidats sémantiques : 0`**
- le concept / QueryPlan est marqué **`fallback`**
- malgré cela, `FINAL PERSONNALISÉ` retourne 20 résultats avec des scores ~47–52 %.

Exemples observés dans le résultat final :

1. `Power Alley` — 52 % — `strong drama genre affinity`, `preferred era`
2. `A Young Pirate's Tale` — 52 % — `strong adventure genre affinity`, `preferred era`
3. `In The Street Today` — 51 %
4. `GO INCREDIBLY FAST` — 50 %
5. `Space Terror` — 50 %
6. `The Disappearance of Josef Mengele` — 49 %
7. `BRZRKR` — 49 %
8. `Dreams of the Moon` — 49 %
9. `Class` — 49 %
10. `De Gaulle` — 48 %
12. `Star Trek II: The Wrath of Khan` — 48 %
13. `Jay and Silent Bob Reboot` — 48 %
16. `The Marriage of Maria Braun` — 47 %
20. `Beverly Hills Cop III` — 47 %

Ces résultats montrent que le fallback fournit un pool générique ensuite reranké principalement selon les affinités du profil. Ils ne constituent donc pas une validation du pipeline sémantique attendu.

L’intention envoyée à l’embedding est pourtant bien renseignée, par exemple :

> Cette collection explore des histoires d'aventure où le voyage dans le temps est essentiel à l'intrigue. Les films offrent une combinaison d'action, de suspense et de mystère, tout en posant des questions sur le destin et les choix. Le ton est souvent intriguant, avec des rebondissements surprenants qui maintiennent l'attention.

## Problème

Le pipeline cible est :

```text
ShelfConcept / semanticIntent
        ↓
embedding de la requête
        ↓
pgvector retrieval (~200 candidats)
        ↓
hard filters
        ↓
SCORE_MODEL_V2 + ProfileTaste
        ↓
diversité
        ↓
final 20/24
```

Le comportement observé ressemble actuellement à :

```text
ShelfConcept / semanticIntent
        ↓
semantic retrieval = 0
        ↓
fallback générique
        ↓
SCORE_MODEL_V2 principalement piloté par ProfileTaste
        ↓
20 résultats faiblement liés au concept
```

**Ne pas modifier les poids de SCORE_MODEL_V2 avant d’avoir identifié pourquoi le retrieval sémantique retourne zéro candidat.** Le problème doit d’abord être diagnostiqué en amont du reranking.

## Investigation demandée

### 1. Vérifier le corpus vectoriel réellement utilisé par recommendation-engine

Sur la DB et le service réellement utilisés en production, exposer/collecter des diagnostics sanitisés :

- [ ] nombre total de Movies / Series canoniques ;
- [ ] nombre total d’embeddings valides ;
- [ ] embeddings par `mediaType` ;
- [ ] modèle/provider/version d’embedding ;
- [ ] dimension stockée ;
- [ ] dimension de l’embedding de requête ;
- [ ] type physique de la colonne (`vector(...)` vs fallback) ;
- [ ] index pgvector réellement présent/utilisé ;
- [ ] document/model versions actuellement éligibles ;
- [ ] DB/schema réellement ouverts par `recommendation-engine`.

Ne jamais exposer `DATABASE_URL`, credentials ou secrets.

### 2. Tracer précisément les compteurs du retrieval

Le debug doit distinguer au minimum :

```text
embeddingQueryGenerated: true/false
vectorRowsEligible: N
retrievedCandidates: N
postHardFilterCandidates: N
postExclusionCandidates: N
rerankedCandidates: N
finalResults: N
fallbackUsed: true/false
fallbackReason: ...
```

Il faut pouvoir distinguer :

- zéro ligne vectorielle disponible ;
- requête pgvector retournant zéro ligne ;
- 200 candidats récupérés puis tous éliminés par filtres ;
- mismatch modèle/dimension/version ;
- erreur pgvector transformée silencieusement en fallback ;
- exclusion/session/profile supprimant tous les candidats.

### 3. Vérifier `runSemanticSearch()` end-to-end

Tracer le parcours exact :

```text
semanticIntent
→ embedding provider
→ query vector
→ SQL pgvector
→ raw rows
→ mapping MediaRef
→ hard filters
→ exclusions
```

- [ ] vérifier que `candidatePoolSize` de #250 atteint réellement ce chemin ;
- [ ] vérifier qu’une cible ~200 produit bien jusqu’à ~200 résultats avant filtres ;
- [ ] vérifier les conditions SQL implicites (`model`, `documentVersion`, `mediaType`, nulls, availability, etc.) ;
- [ ] vérifier qu’aucun filtre `WATCH_NOW`/availability n’est appliqué par erreur à une shelf qui ne le demande pas ;
- [ ] vérifier que Movie/Series IDs de l’index correspondent aux IDs canoniques attendus par le moteur.

### 4. Ne plus masquer un échec sémantique derrière un résultat apparemment valide

Le fallback reste utile pour la résilience produit, mais le Lab doit rendre son origine impossible à confondre avec un résultat sémantique normal.

En debug/Lab :

- [ ] afficher clairement `Semantic retrieval failed/empty — fallback results` ;
- [ ] afficher `fallbackReason` ;
- [ ] conserver séparément les compteurs vectoriels et fallback ;
- [ ] ne jamais présenter les 20 résultats fallback comme preuve que le pipeline sémantique fonctionne.

En production Home, le fallback peut rester transparent pour l’utilisateur final, tout en restant observable côté diagnostics.

### 5. Vérifier le comportement de V2 en absence de signal sémantique

Sans modifier les poids à ce stade :

- [ ] confirmer pourquoi les scores fallback sont tassés autour de 47–52 % ;
- [ ] confirmer quelle valeur de `semanticSimilarity` est utilisée pour ces candidats ;
- [ ] ne pas transformer l’absence de score sémantique en score neutre artificiellement compétitif sans l’indiquer ;
- [ ] exposer le score breakdown complet dans le Lab pour au moins les 20 résultats.

Le but est diagnostique. Un ticket séparé pourra ajuster V2 si nécessaire une fois le retrieval réparé.

## Tests réels obligatoires

Après correction, exécuter contre **la production ou un snapshot réellement peuplé avec les mêmes embeddings** :

### `Aventures à travers le temps`

Attendu :

```text
retrievedCandidates > 0
```

et idéalement proche du `candidatePoolSize` avant filtres si le corpus le permet.

Les résultats vectoriels doivent être sémantiquement reliés au voyage temporel / temporalité / aventure, et non un pool arbitraire piloté uniquement par genres du profil.

### `SF qui fait réfléchir`

Vérifier :
- pool vectoriel non vide ;
- ~200 candidats avant filtres lorsque possible ;
- final personnalisé provenant de ce pool.

### `film qui retourne le cerveau`

Même validation.

### Contrôle négatif

Tester une intention volontairement étrange/rare afin de vérifier que le debug distingue correctement un vrai pool faible/empty d’une panne du moteur vectoriel.

## Acceptance criteria

- [ ] `Aventures à travers le temps` ne retourne plus `Candidats sémantiques : 0` lorsque des embeddings éligibles existent.
- [ ] Le moteur expose séparément `retrieved`, `filtered`, `reranked` et `final` counts.
- [ ] Le Lab indique explicitement tout fallback et sa raison.
- [ ] `candidatePoolSize` contrôle réellement la profondeur de retrieval.
- [ ] Les dimensions/modèles/versions query ↔ corpus sont cohérents et vérifiés.
- [ ] Les erreurs pgvector/embedding ne sont pas silencieusement transformées en résultat générique dans les diagnostics.
- [ ] Le résultat `Final personnalisé` est démontré comme provenant du pool sémantique lorsque celui-ci fonctionne.
- [ ] Les trois requêtes réelles ci-dessus produisent des candidats vectoriels pertinents.
- [ ] Aucun secret n’est exposé dans les diagnostics.

## Completion rule

**Ne pas fermer ce ticket parce qu’un test unitaire de repository/vector search passe.**

La fermeture nécessite une preuve sur le système réellement peuplé montrant au minimum pour `Aventures à travers le temps` :

```text
semantic intent
→ query embedding OK
→ vector corpus eligible > 0
→ retrieved candidates > 0
→ post-filter candidates > 0
→ SCORE_MODEL_V2 reranking
→ final results
```

avec les compteurs et `fallbackUsed=false` visibles dans le Recommendation Lab/debug.

## Suite

Une fois ce ticket validé, reprendre l’évaluation qualitative de `SCORE_MODEL_V2` et du mapping `ShelfConcept → QueryPlan`. Ne pas tirer de conclusion sur la qualité des poids/personnalisation tant que le retrieval sémantique est en fallback.