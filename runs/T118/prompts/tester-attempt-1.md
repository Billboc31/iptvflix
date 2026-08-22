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

# Role — Tester

## Mission

Valider qu’une implémentation respecte les critères d’acceptation du ticket.

## Tu dois

- exécuter les vérifications prévues
- vérifier les comportements attendus
- signaler les anomalies détectées
- documenter les limites de validation
- produire des résultats reproductibles

## Tu ne dois pas

- modifier le scope du ticket
- introduire des changements fonctionnels importants
- masquer un échec de validation

## Sortie attendue

- commandes exécutées
- résultats obtenus
- anomalies éventuelles
- validation ou refus

## Règles

- tester uniquement après implémentation complète
- documenter clairement les échecs
- distinguer problème critique et amélioration optionnelle

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

# SKILL: testing

# Skill — Testing

## Objectif

Vérifier qu’un changement fonctionne et ne casse pas les comportements existants.

## Règles

- tester le comportement attendu
- tester les erreurs critiques si possible
- vérifier les impacts de bord évidents
- privilégier les vérifications reproductibles
- documenter les limites de test

## Refuser si

- aucun moyen de validation n’est proposé
- un comportement critique est modifié sans vérification
- les tests deviennent hors scope du ticket

---

# SKILL: debugging

# Skill — Debugging

## Objectif

Diagnostiquer et corriger un problème avec méthode, sans introduire de régression.

## Règles

- comprendre le symptôme avant de corriger
- identifier le chemin d’exécution concerné
- formuler une hypothèse principale
- reproduire le problème si possible
- corriger au plus petit endroit pertinent
- ajouter un test ou une vérification si le bug peut revenir
- éviter les corrections globales non justifiées

## Refuser si

- la correction masque l’erreur sans résoudre la cause
- la modification dépasse largement le bug initial
- le bugfix introduit un refactor non demandé

---

# TASK

# Generic Tester Task

Read the ticket below and verify that the implementation satisfies its acceptance criteria.

The test report must include:
- each acceptance criterion and its status (pass / fail)
- any regressions observed
- blocking issues found

The ticket follows.


# T118 — Diagnostiquer et fiabiliser la preview ShelfConcept en production

**Source**: GitHub Issue #252

## Description

## Contexte

Depuis la PR #251, le Lab appelle la nouvelle preview `POST /shelf-concepts/:id/preview`, qui délègue à `RecommendationEngineClient.previewShelfConcept()` puis au recommendation-engine sur `/v1/shelf-concepts/:id/preview`.

En production, cliquer sur **Prévisualiser** affiche actuellement :

`Recommendation engine unavailable`

Le problème est difficile à diagnostiquer car `RecommendationEngineClient.previewShelfConcept()` transforme indistinctement en `null` :
- toute réponse non-2xx (404/400/500/etc.) ;
- tout timeout ;
- toute exception réseau.

L’API convertit ensuite ce `null` en 502 générique.

## Hypothèses principales

1. Le recommendation-engine déployé n’expose pas encore la nouvelle route → 404.
2. La preview dépasse le timeout fixe de 15 s, car elle exécute :
   - retrieval vectoriel brut ;
   - puis pipeline complet personnalisé + SCORE_MODEL_V2.
3. Erreur 500 réelle côté recommendation-engine masquée par le client.

## Travaux demandés

### 1. Observabilité du client recommendation-engine
- [ ] Ne plus avaler silencieusement les erreurs dans `previewShelfConcept()`.
- [ ] Logger au minimum : endpoint, status HTTP, durée, timeout vs erreur réseau, et body d’erreur tronqué/sanitisé.
- [ ] Ne jamais logger de secrets ni headers sensibles.
- [ ] Ajouter un type/résultat d’erreur structuré ou une exception interne permettant à la route API de distinguer les cas.

### 2. Timeout spécifique à la preview
- [ ] Ne pas utiliser obligatoirement le timeout global de 15 s pour cette route lourde.
- [ ] Ajouter une config dédiée, par ex. `RECOMMENDATION_PREVIEW_TIMEOUT_MS`, avec une valeur par défaut raisonnable (30–60 s).
- [ ] Conserver le timeout actuel pour les endpoints légers.
- [ ] Reporter explicitement un timeout au lieu de `unavailable` générique.

### 3. Erreurs HTTP explicites côté API
- [ ] Si recommendation-engine renvoie 404 : retourner un message du type `Recommendation preview endpoint not deployed`.
- [ ] Si timeout : retourner 504 avec `Recommendation preview timed out`.
- [ ] Si 5xx engine : retourner 502 avec le status / message utile.
- [ ] Si erreur réseau : retourner 502 avec `Recommendation engine unreachable`.
- [ ] Le frontend doit afficher le message précis retourné par l’API.

### 4. Vérification de déploiement / route
- [ ] Ajouter ou vérifier un test d’intégration garantissant que `/v1/shelf-concepts/:id/preview` est enregistrée par le recommendation-engine.
- [ ] Vérifier que le service API appelle exactement la bonne base URL et le bon chemin.
- [ ] Ajouter éventuellement un health/version endpoint ou une information de version permettant de confirmer que l’engine déployé contient la feature de preview.

### 5. Tests
- [ ] Test client : 404 engine → erreur structurée 404.
- [ ] Test client : 500 engine → erreur structurée 500.
- [ ] Test client : AbortError → timeout explicite.
- [ ] Test route API : mappe timeout en 504, engine 5xx/réseau en 502.
- [ ] Test nominal : preview >15 s mais < timeout preview configuré doit réussir.

## Acceptance criteria

- En cas d’échec de preview, l’UI n’affiche plus systématiquement `Recommendation engine unavailable`.
- Les logs permettent de savoir immédiatement si le problème est un 404, un 500, un timeout ou une erreur réseau.
- La preview dispose d’un timeout adapté au coût du pipeline complet.
- Le chemin nominal fonctionne en production sans être coupé artificiellement à 15 secondes.
- Aucun secret n’est exposé dans les logs ou réponses utilisateur.

## But

Pouvoir diagnostiquer et corriger le bug de preview ShelfConcept actuellement visible en production, sans masquer la cause réelle derrière un 502 générique.