# PR Review — T055 (attempt 2)

## Résumé

L'implémentation de second passage corrige tous les points bloquants et significatifs. Voici le verdict :

---

## Corrections validées

**[BLOQUANT 1] Token delivery — CORRIGÉ**
`deviceToken varchar(64)` ajouté au schéma `pairingCodes` et à la migration. `approvePairingCode` stocke le plain-text token ; `getPairingStatus` le retourne via `row.deviceToken ?? undefined`. La TV reçoit son credential.

**[BLOQUANT 2] Web auth sur approbation/gestion — CORRIGÉ**
`authenticateWeb` middleware créé (Bearer `WEB_SECRET`, 503 si non configuré, 401 si absent/incorrect). Guard appliqué sur les 6 endpoints ciblés : `GET/POST /pairing/codes/:code[/approve]`, `GET/PATCH/DELETE /devices/*`, `POST /devices/:id/commands`.

**[SIGNIFICATIF 3] État stale dans `getPendingCommands` — CORRIGÉ**
Les lignes transitionnées vers `delivered` sont copiées avec `{ ...row, state: 'delivered' }` avant `map(toResponse)`.

**[SIGNIFICATIF 4] Test "revoked device cannot authenticate" — CORRIGÉ**
`authenticateDevice.test.ts:82-90` couvre le cas → 401.

---

## Observations mineures (non bloquantes)

- `PairingCodeAlreadyApprovedError` reste du code mort (défini, jamais lancé). Cleanup recommandé post-merge.
- `deviceToken` n'est pas nulé après récupération TV (suggestion de la première review non implémentée). Acceptable : exposition bornée par le TTL 5 min du code.

---

## Critères d'acceptation : tous satisfaits.

545 tests verts, build TypeScript propre.

IMPLEMENTATION_APPROVED
