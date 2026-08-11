Now I'll write the review based on everything I've read.

---

# PR Review — T004: Implement IPTV source management

## Résumé

Implémentation du registre de sources IPTV (XTREAM/M3U) avec CRUD complet, test de connexion, et protection des credentials. Stack : TypeScript / Fastify / Drizzle ORM / PostgreSQL.

---

## Vérifications effectuées

- Modèle de données et migration SQL
- Contrats API partagés (`@iptvflix/api-contracts`)
- Service layer (`source-service.ts`) : logique métier et gestion des erreurs
- Routes (`sources.ts`) : endpoints REST et validation
- Protection des credentials à tous les niveaux
- Test suite complète (`sources.test.ts`)
- Configuration du logger Fastify en production

---

## Points validés

**Modèle de domaine**
- Enum `source_type` (XTREAM | M3U) enforced en base via `pgEnum`
- Champ `enabled` boolean pour activer/désactiver sans suppression
- UUID généré automatiquement, timestamps `created_at` / `updated_at`
- `updatedAt: new Date()` correctement passé lors du `updateSource`

**Redaction des credentials**
- Le helper `toResponse()` retire le `password` via destructuring (`{ password: _omit, ...rest }`) avant tout retour API
- Appliqué systématiquement dans `createSource`, `listSources`, `getSource`, `updateSource`
- Les messages d'erreur du test de connexion ne contiennent jamais l'URL, le username, ou le password

**Test de connexion**
- Timeout 5s via `AbortSignal.timeout(5000)`
- Tous les cas d'erreur (réseau, timeout, HTTP non-200, JSON invalide) retournent un `TestSourceResult` sanitizé sans planter
- M3U retourne un résultat propre `{ ok: false, message: '...' }` sans crash

**Acceptance criteria du ticket**
- Toutes les 8 cases sont couvertes
- 15 tests couvrant création, listing, lecture, mise à jour, suppression, test de connexion, et assertion de logs

**Sécurité logs**
- Fastify avec `logger: true` (pino) ne logue pas les request bodies par défaut — le password du POST body ne passe pas dans les logs
- Test explicite qui capture les logs et vérifie l'absence du password

---

## Problèmes détectés

### Mineur 1 — `POST /sources` sans try-catch (incohérence)

Tous les autres endpoints wrappent leur appel service dans un `try-catch` explicite pour les `NotFoundError`. L'endpoint `POST /sources` (ligne 22 dans `routes/sources.ts`) appelle `createSource(body)` sans protection : une erreur DB inattendue bubble vers le handler d'erreur global de Fastify, qui peut exposer des détails internes.

```typescript
// routes/sources.ts:14-24 — pas de try-catch autour de createSource
const source = await createSource(body)
return reply.status(201).send(source)
```

Correction simple :
```typescript
try {
  const source = await createSource(body)
  return reply.status(201).send(source)
} catch (err) {
  throw err  // ou gérer les 500 explicitement
}
```

Non bloquant — Fastify retourne un 500 propre — mais incohérent avec les autres routes.

### Mineur 2 — Pas de validation du format `baseUrl`

La validation vérifie seulement la présence (`!body.baseUrl`) mais pas le format URL. Une valeur comme `"not-a-url"` est stockée sans erreur et échoue silencieusement au moment du test de connexion seulement.

Non bloquant pour ce ticket (la validation fine d'URL peut venir avec un schema Fastify / Zod plus tard).

### Mineur 3 — URL Xtream avec credentials en query params

La fonction `testSourceConnection` construit :
```
${row.baseUrl}/player_api.php?username=...&password=...
```

Le password apparaît en clair dans la chaîne `url` en mémoire. C'est imposé par le protocole Xtream Codes. Les erreurs sont correctement catchées et sanitizées. Mais si un middleware de logging HTTP client venait à être ajouté (ex. pino-http intercepting fetch), le password apparaîtrait dans les traces.

Mention à conserver en documentation / commentaire pour prévenir une régression future.

### Mineur 4 — Pas de validation de format UUID sur les path params

Un `id` invalide (ex. `"abc"`) passé à Drizzle entraîne une erreur PostgreSQL non catchée → 500 non contrôlé au lieu d'un 404 ou 400 explicite. Hors scope du ticket mais à intégrer avec la validation globale.

---

## Risques éventuels

- **Évolution de la config pino** : si un sérialiseur de request body est ajouté à Fastify (`reqCustomProps` ou `serializers`), le password du POST body pourrait fuiter. Le test de log assertion constitue un filet de sécurité efficace pour détecter ce cas.
- **Xtream URL en mémoire** : point documenté ci-dessus. Pas de risque immédiat, risque de régression si logging HTTP client est ajouté.

---

## Décision

- **APPROVED** avec observations mineures

L'implémentation couvre l'intégralité des acceptance criteria du ticket. La protection des credentials est rigoureuse et multi-couches. Les tests sont complets. Les problèmes détectés sont mineurs et n'affectent pas la sécurité ou la correction fonctionnelle.

---

## Actions demandées

Aucune correction bloquante. En suivi optionnel :

1. Ajouter un try-catch dans `POST /sources` pour cohérence avec les autres routes (1-2 lignes).
2. Prévoir une validation de format `baseUrl` lors de l'introduction d'un schema Fastify ou Zod (ticket ultérieur).
3. Documenter le comportement de l'URL Xtream avec credentials pour prévenir une régression de logging.

IMPLEMENTATION_APPROVED
