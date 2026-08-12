# PR Review — T055: Add secure TV device pairing and remote playback command channel (attempt 2)

## Résumé

L'implémentation de second passage corrige l'ensemble des points bloquants et significatifs identifiés lors de la première review. La structure globale est propre : routes bien enregistrées, middleware de device-token correct, SSE via EventEmitter in-process adapté au déploiement Railway, schéma Drizzle cohérent, et contrats api-contracts complets. 545 tests verts sur 39 fichiers, build TypeScript propre.

---

## Vérifications effectuées

- Services : `pairing.service.ts`, `device.service.ts`, `command.service.ts`
- Middleware : `authenticateDevice.ts`, `authenticateWeb.ts`
- Routes : `pairing.ts`, `devices.ts`, `commands.ts`
- Schéma Drizzle : `db/schema/devices.ts`, `db/schema/playback-commands.ts`
- Migration : `migrations/0021_tv_pairing_commands.sql`
- Lib : `lib/device-events.ts`
- Config : `config/env.ts`
- Contrats : `packages/api-contracts/src/device.ts`
- Tests : `pairing.test.ts`, `devices.test.ts`, `commands.test.ts`, `middleware/authenticateDevice.test.ts`

---

## Corrections validées (issues première review)

### [BLOQUANT 1] Token delivery — CORRIGÉ ✅

`pairingCodes.deviceToken varchar(64)` ajouté dans le schéma Drizzle (`db/schema/devices.ts:19`) et dans la migration (`0021_tv_pairing_commands.sql:19`). `approvePairingCode` stocke le token plain-text (`pairing.service.ts:95`). `getPairingStatus` retourne désormais `row.deviceToken ?? undefined` (`pairing.service.ts:60`). La TV reçoit son credential lors du polling.

### [BLOQUANT 2] Web auth sur les routes d'approbation/gestion — CORRIGÉ ✅

`middleware/authenticateWeb.ts` créé : vérifie `Authorization: Bearer <WEB_SECRET>`, retourne 503 si `WEB_SECRET` n'est pas configuré, 401 si le header est absent ou incorrect. `WEB_SECRET` exporté depuis `config/env.ts:11`.

Guard appliqué sur tous les endpoints ciblés :
- `GET /pairing/codes/:code` — `pairing.ts:47`
- `POST /pairing/codes/:code/approve` — `pairing.ts:62`
- `GET /devices` — `devices.ts:7`
- `PATCH /devices/:id` — `devices.ts:14`
- `DELETE /devices/:id` — `devices.ts:31`
- `POST /devices/:id/commands` — `commands.ts:25`

### [SIGNIFICATIF 3] État stale dans `getPendingCommands` — CORRIGÉ ✅

`command.service.ts:64-75` : les lignes transitionnées vers `delivered` sont maintenant copiées avec `{ ...row, state: 'delivered' }` dans `updatedRows` avant le `map(toResponse)`. La TV reçoit l'état réel.

### [SIGNIFICATIF 4] Test "revoked device cannot authenticate" manquant — CORRIGÉ ✅

`middleware/authenticateDevice.test.ts:82-90` : test dédié qui confirme qu'un device avec `revokedAt` non-null retourne 401.

---

## Points validés

- `POST /pairing/codes` : retourne `{ code, expiresAt }` sans aucun secret de compte. Conforme.
- `getPairingStatus` : garde `gt(pairingCodes.expiresAt, new Date())` dans la requête — code expiré → 404 pour la TV. Comportement cohérent avec la sémantique ticket (pas de requirement pour un état "expired" côté TV).
- `getPairingCodeDetail` : expose bien `status: 'expired'` pour le côté Web — les deux endpoints ont des sémantiques distinctes et appropriées.
- Déduplication : `acknowledgeCommand` est idempotente (`command.service.ts:89`) ; `getPendingCommands` exclut les commandes `acknowledged` et expire les stale avant lecture.
- SSE : EventEmitter singleton keyed par `deviceId`, heartbeat nettoyé sur `close`, listener correctement détaché. Acceptable pour single-process Railway.
- `authenticateDevice` : hash SHA-256 du Bearer, vérifie `revokedAt`, met à jour `lastSeenAt`. Conforme.
- Aucune credential Xtream/Plex dans les payloads de commandes — vérifié dans `commands.ts` et dans les tests.
- `PairingCodeDetailResponse` correctement ajouté dans `api-contracts/src/device.ts` (type distinct de `PairingStatusResponse`).
- Migration `0021_tv_pairing_commands.sql` : cohérente avec les schémas. FKs, UNIQUEs et enums présents.

---

## Observations mineures (non bloquantes)

### `PairingCodeAlreadyApprovedError` — code mort persistant

`pairing.service.ts:108-113` : cette classe d'erreur est définie mais n'est jamais lancée ni exportée. Signal trompeur d'une protection contre le double-approve qui n'existe pas. Cleanup recommandé mais sans impact fonctionnel.

### `deviceToken` non nul après récupération TV

La première review suggérait de nuller `deviceToken` après sa première récupération par la TV (sécurité défense en profondeur). Non implémenté. L'exposition est bornée par le TTL 5 min du code de pairing, ce qui est acceptable en l'état. Amélioration possible post-merge si le profil de risque l'exige.

---

## Critères d'acceptation ticket

| Critère | Status |
|---|---|
| TV peut obtenir un code de pairing sans exposer de secrets | ✅ |
| Web approuve → TV reçoit un credential révocable | ✅ |
| List / rename / revoke de devices depuis Web/API | ✅ |
| Une commande cible exactement un device | ✅ |
| TV reçoit la commande en quelques secondes (SSE) | ✅ |
| Reconnect/retry sans double-lecture | ✅ |
| Device révoqué/expiré ne peut pas s'authentifier | ✅ |
| Payloads sans credentials Xtream/Plex | ✅ |
| Tests automatisés couvrant pairing, révocation, auth, déduplication | ✅ |

---

## Décision

Tous les points bloquants et significatifs de la première review ont été corrigés. L'implémentation est conforme au ticket, au plan et aux critères d'acceptation. Les observations mineures restantes n'impactent pas la fonctionnalité ni la sécurité opérationnelle.

IMPLEMENTATION_APPROVED
