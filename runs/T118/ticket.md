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
