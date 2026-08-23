# T122 — Bound profile boosts by semantic relevance in thematic reranking

**Source**: GitHub Issue #260

## Description

## Contexte

#258 a été implémenté et le pipeline sémantique fonctionne correctement, mais le test réel `Aventures à travers le temps` montre que le reranker continue à survaloriser des contenus faiblement liés à l’intention grâce aux préférences profil.

Pipeline observé :

```text
37 semanticRetrieved
→ 37 semanticPostFilter
→ 0 fallbackCandidates
→ 20 rerankedCandidates
→ 20 finalResults
```

Le retrieval brut est sain et contient notamment :

- `The Time Thief`
- `Chronovisor`
- `Time Lapse`
- `House of Time`
- `The Time Machine`
- `Timescape: Back to the Dinosaurs`
- `The Visitor from the Future`

Mais le final personnalisé contient encore trop haut des contenus qui collent surtout au profil, par exemple :

- `The Hobbit: An Unexpected Journey` #6 — raison visible : `strong adventure genre affinity`, `preferred language`
- `Journey to the Center of the Earth` #11 — `strong adventure genre affinity`, `preferred language`
- `The Adventures of Tintin` #15 — `animation genre affinity`, `preferred language`
- `The Island of Thirty Coffins` #16 — `strong drama genre affinity`
- `The Island` #20 — `adventure genre affinity`

Le problème n’est donc plus le retrieval : **la personnalisation peut encore compenser une pertinence sémantique trop faible**.

## Principe produit à imposer

> Le retrieval fixe le sujet de la shelf.  
> Le reranker personnalise l’ordre à l’intérieur des candidats pertinents.  
> Un candidat peu pertinent ne doit pas pouvoir devenir un top résultat uniquement grâce au profil.

Le but n’est PAS de revenir à un tri vectoriel pur.

## Objectif

Modifier le reranking des shelves thématiques pour que les boosts profil soient **bornés / modulés par la pertinence sémantique**.

Exemple de comportement souhaité :

```text
semantic relevance élevée
→ personnalisation libre et forte

semantic relevance moyenne
→ personnalisation possible mais plafonnée

semantic relevance faible
→ les bonus genre/langue/ère ne doivent pas suffire à propulser le candidat au-dessus de contenus nettement plus pertinents
```

## Travaux demandés

### 1. Inspecter ce que #258 a réellement introduit

Documenter le chemin exact :

```text
semanticSimilarity
→ semantic gate/floor éventuel
→ contributions profile
→ finalScore
```

Identifier pourquoi `The Hobbit` peut encore arriver #6 dans `Aventures à travers le temps`.

### 2. Introduire un mécanisme générique de modulation

Implémenter une stratégie versionnée/configurable, par exemple :

- **profile boost cap as a function of semanticSimilarity** ;
- **multiplicative semantic gating** sur les contributions profil ;
- **minimum semantic contribution ratio** dans le score final ;
- ou une combinaison justifiée.

Exemple conceptuel (pas une formule imposée) :

```text
profileBoostEffective = profileBoostRaw * semanticConfidenceFactor
```

avec `semanticConfidenceFactor` croissant avec la pertinence sémantique.

Le comportement doit être monotone : plus un candidat est faible sémantiquement, moins les goûts du profil peuvent le sauver.

### 3. Éviter les seuils absolus naïfs

Les scores vectoriels observés sur cette shelf sont autour de 41–47 %. Un seuil global arbitraire du type `semantic > 0.60` casserait le système.

Préférer une logique relative ou normalisée par requête/pool, par exemple :

- distance au top score ;
- percentile dans le pool ;
- z-score / normalisation locale ;
- combinaison score absolu + position relative.

La stratégie doit fonctionner sur des distributions de score différentes selon les concepts.

### 4. Afficher le vrai breakdown dans le Lab

Pour chaque résultat final, exposer au minimum :

```text
semanticSimilarityRaw
semanticRelevanceNormalized
semanticContribution
profileBoostRaw
profileBoostEffective
profileBoostCap / semanticGateFactor
genreContribution
languageContribution
eraContribution
otherContributions
penalties
finalScore
```

Il doit être possible de comprendre visuellement pourquoi un candidat a gagné/perdu des places.

### 5. Ajouter une métrique de dérive

Pour chaque final item :

```text
rawVectorRank
finalRank
rankDelta
semanticPercentile
```

et flagger les cas du type :

```text
large upward rank delta + weak semantic percentile
```

afin de détecter les candidats sauvés excessivement par le profil.

## Test principal de non-régression

### Shelf : `Aventures à travers le temps`

Avec le même profil et le même corpus que le test actuel :

Les contenus explicitement temporels doivent dominer le haut du classement final, notamment lorsqu’ils sont disponibles dans le pool :

- `Time Trap`
- `The Time Travelers`
- `The Time Machine`
- `Timescape: Back to the Dinosaurs`
- `The Visitor from the Future`
- `Time Lapse`
- `House of Time`
- `The Time Thief`
- `Chronovisor`

Un contenu comme `The Hobbit: An Unexpected Journey` ne doit pas être top 6 uniquement parce que :

```text
strong adventure genre affinity
+ preferred language
```

alors que plusieurs candidats temporels sont disponibles.

`Tintin`, `Journey to the Center of the Earth`, `The Island`, etc. peuvent éventuellement rester dans le bas du final si leur score semantic est suffisant, mais ne doivent pas supplanter des candidats beaucoup plus fidèles à l’intention à cause du profil.

## Tests supplémentaires

### Shelf action / aventure

La personnalisation doit rester forte : le but n’est pas de figer l’ordre vectoriel.

### `SF qui fait réfléchir`

Un blockbuster très aimé du profil mais faiblement cérébral ne doit pas écraser les vrais résultats `thought-provoking SF`.

### `film qui retourne le cerveau`

Même règle : cohérence avec l’intention avant préférence générale du profil.

## Acceptance criteria

- [ ] La cause précise du comportement de #258 est documentée.
- [ ] Les boosts profil sont explicitement modulés/bornés par la pertinence sémantique sur les shelves thématiques.
- [ ] Le mécanisme est configurable et versionné.
- [ ] Aucun seuil absolu fragile n’est hardcodé sur la distribution actuelle 41–47 %.
- [ ] Le Lab expose semantic relevance normalisée + profile boost brut/effectif + rank delta.
- [ ] `The Hobbit` n’est plus propulsé très haut dans `Aventures à travers le temps` uniquement via genre/langue.
- [ ] Les candidats temporels dominent le haut du final lorsque présents dans le Raw Vector.
- [ ] La personnalisation reste active et visible entre candidats sémantiquement pertinents.
- [ ] Les shelves larges/action restent fortement personnalisables.
- [ ] Tests `SF qui fait réfléchir` et `film qui retourne le cerveau` validés.

## Completion rule

Ne pas fermer ce ticket sur une simple modification de poids, un test unitaire ou un benchmark synthétique.

Validation obligatoire dans le Recommendation Lab sur le cas réel `Aventures à travers le temps`, avec comparaison **avant/après** montrant :

```text
Raw Vector sain
→ semantic normalization/gating
→ profile boosts bornés
→ final dominé par l’intention
→ personnalisation toujours active
```

Le résultat final ne doit pas être identique au Raw Vector, mais il doit respecter cette règle :

> **la personnalisation peut réordonner la pertinence ; elle ne peut pas sauver une faible pertinence au point de remplacer l’intention.**
