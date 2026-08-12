IMPLEMENTATION_FIX_REQUIRED

---

## Résumé de la review T055

L'implémentation est structurellement solide (routes enregistrées, middleware de device auth correct, SSE propre, schéma cohérent avec les UUIDs du catalogue). Deux bugs bloquants ont été identifiés :

**[BLOQUANT 1] — Le token n'atteint jamais la TV**
`getPairingStatus` retourne `deviceToken: undefined` (ligne 60 de `pairing.service.ts`). Le token plain-text est généré dans `approvePairingCode` et rendu à la Web app, mais n'est pas stocké en DB. La TV qui sonde son code de pairing reçoit `{ status: 'approved', deviceToken: undefined }` — elle ne peut pas s'authentifier. Le flow de pairing est non-fonctionnel de bout en bout.

**[BLOQUANT 2] — Aucune auth Web sur les routes d'approbation/gestion**
`POST /pairing/codes/:code/approve`, `GET/PATCH/DELETE /devices/*` et `POST /devices/:id/commands` sont ouverts sans aucune vérification d'identité. N'importe quel client peut approuver un pairing code en cours et voler le device token. Violates the ticket AC : *"An authenticated Web user can approve pairing"*.

**Actions obligatoires :**
1. Ajouter une colonne `device_token` dans `pairing_codes` pour stocker le token temporairement et le retourner via `getPairingStatus`.
2. Ajouter un guard d'auth Web minimal sur les routes d'approbation et de gestion (même provisoire en attendant #95).

**Points significatifs recommandés :**
- `getPendingCommands` retourne `state: 'pending'` même après transition vers `delivered` en DB (stale data).
- Test manquant : "revoked device cannot authenticate" (critère d'acceptation du ticket).
