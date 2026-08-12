# PR Review — T055: Add secure TV device pairing and remote playback command channel

## Résumé

L'implémentation couvre l'ensemble des routes, services, schéma et tests demandés par le plan. La structure est propre, les erreurs sont bien typées, l'EventEmitter SSE est simple et efficace pour un déploiement single-process. Deux bugs bloquants empêchent cependant le fonctionnement réel du système de pairing et violent les critères d'acceptation du ticket.

---

## Vérifications effectuées

- Routes : `pairing.ts`, `devices.ts`, `commands.ts`
- Services : `pairing.service.ts`, `device.service.ts`, `command.service.ts`
- Middleware : `authenticateDevice.ts`
- SSE : `lib/device-events.ts`
- Schéma Drizzle : `devices.ts`, `playback-commands.ts`
- Migration : `0021_tv_pairing_commands.sql`
- Contrats : `packages/api-contracts/src/device.ts`
- Tests : `pairing.test.ts`, `devices.test.ts`, `commands.test.ts`
- Registrations dans `apps/api/src/index.ts`

---

## Points validés

- Toutes les routes sont correctement enregistrées dans `index.ts` (lignes 24–26, 66–68).
- `authenticateDevice` hash correctement le token Bearer, vérifie la révocation, et met à jour `lastSeenAt` — implémentation conforme au plan.
- `command.service.ts` : la déduplication via `acknowledgeCommand` est idempotente (ligne 85 : `if (row.state === 'acknowledged') return`). `expireStaleCommandsForDevice` est appelé avant la récupération des commandes pending.
- SSE : l'EventEmitter est un singleton keyed par `deviceId`, le heartbeat est nettoyé sur `close`, le listener est correctement détaché. Acceptable pour un déploiement Railway single-process.
- Migration `0021_tv_pairing_commands.sql` : cohérente avec les schémas Drizzle. Les FKs et UNIQUEs sont présents.
- Les types `mediaId` / `availabilityId` sont `uuid` — conforme aux PKs réels du catalogue (movies, episodes, availabilities utilisent tous `uuid`). L'écart avec le plan (qui indiquait `integer`) est une erreur du plan, non de l'implémentation.
- Aucune credential Xtream/Plex dans les payloads de commandes — conforme au critère d'acceptation.
- `PairingCodeResponse`, `DeviceResponse`, `PlaybackCommandRequest/Response` correctement exportés depuis `api-contracts`.

---

## Problèmes détectés

### [BLOQUANT 1] `getPairingStatus` ne retourne jamais le `deviceToken` à la TV

**Fichier** : `apps/api/src/services/pairing.service.ts`, ligne 60

```typescript
return { status: 'approved', deviceToken: undefined }
```

Le token plain-text est généré dans `approvePairingCode` et retourné une seule fois à la Web app. Il n'est pas stocké en DB (seul `tokenHash` est persisté). Quand la TV sonde `GET /pairing/codes/:code/status`, le service ne peut pas reconstituer le token et retourne `deviceToken: undefined`.

**Conséquence** : la TV ne reçoit jamais sa credential. Le flow de pairing est non-fonctionnel de bout en bout. Violation du critère d'acceptation :
> An authenticated Web user can approve pairing and the TV receives a durable revocable device credential.

**Correction attendue** : stocker le token plain-text temporairement dans `pairing_codes` (nouvelle colonne `device_token text`, NULLée après récupération par la TV), puis le retourner depuis `getPairingStatus` quand `status === 'approved'`.

---

### [BLOQUANT 2] Aucune authentification Web sur les routes d'approbation et de gestion

**Fichiers** : `apps/api/src/routes/pairing.ts`, `apps/api/src/routes/devices.ts`, `apps/api/src/routes/commands.ts`

Les endpoints suivants ne vérifient aucune identité Web :
- `POST /pairing/codes/:code/approve` — n'importe quel client non authentifié peut approuver un code en cours, récupérer le device token et s'emparer du device.
- `GET /devices`, `PATCH /devices/:id`, `DELETE /devices/:id` — listage, renommage et révocation de devices ouverts à tous.
- `POST /devices/:id/commands` — envoi de commandes de lecture à n'importe quel device sans preuve d'identité.

**Contexte** : le plan exclut explicitement l'intégration de l'auth #95, mais précise :
> "**Authenticated (Web session) — approval side**" et "All require Web session auth"

L'absence totale d'auth sur `approve` est un vecteur d'attaque direct. Violation du critère :
> An authenticated Web user can approve pairing

**Correction minimale attendue** : un guard de session Web (même un middleware simpliste utilisant un secret partagé / cookie / header `X-Session-Token` en attendant #95) doit protéger ces routes. L'absence de tout mécanisme est inacceptable même en pré-production.

---

### [SIGNIFICATIF 3] `getPendingCommands` retourne l'état obsolète `pending` après transition vers `delivered`

**Fichier** : `apps/api/src/services/command.service.ts`, lignes 63–73

```typescript
const rows = await db.select()...  // rows[i].state === 'pending'
for (const row of rows) {
  if (row.state === 'pending') {
    await db.update(...).set({ state: 'delivered' })  // DB mis à jour
  }
}
return rows.map(toResponse)  // rows toujours 'pending' en mémoire
```

La TV reçoit des commandes avec `state: 'pending'` alors qu'elles ont déjà été marquées `delivered` en DB. Incohérence entre l'état observé par la TV et l'état réel persisté.

**Correction** : mettre à jour les objets en mémoire avant le `map`, ou refaire un `select` post-update, ou utiliser `.returning()` sur l'`update`.

---

### [SIGNIFICATIF 4] Test manquant : "revoked device cannot authenticate"

**Fichier** : `apps/api/src/routes/devices.test.ts`

Le plan listait explicitement ce cas :
> `devices.test.ts`: revoked device cannot authenticate.

Ce test n'existe pas. Après `DELETE /devices/:id`, rien ne vérifie que le token du device est rejeté (401) par `authenticateDevice`. Il s'agit d'un critère d'acceptation direct :
> Expired/revoked device credentials cannot receive or acknowledge commands.

---

## Risques éventuels

- **`PairingCodeAlreadyApprovedError`** : définie dans `pairing.service.ts` (ligne 108) mais jamais instanciée ni exportée. Code mort sans impact fonctionnel, mais crée une fausse impression de protection contre le double-approve.
- **Numéro de migration** : le plan indiquait `0017_tv_pairing_commands.sql`, la migration réelle est `0021`. Sans impact technique, simple dérive de documentation.
- **Long-poll et charge** : le long-poll sur `GET /pairing/codes/:code/status` boucle en polling DB toutes les secondes pendant 30s par requête TV. Acceptable pour une utilisation mono-utilisateur ; à surveiller si le nombre de devices augmente.

---

## Décision

Deux bugs bloquants empêchent le fonctionnement réel du système :
1. La TV ne peut pas recevoir son token (le flow de pairing est cassé end-to-end).
2. Les endpoints Web d'approbation et de gestion sont complètement ouverts (critère de sécurité du ticket violé).

Ces points doivent être corrigés avant approbation.

## Actions demandées

1. **[Obligatoire]** Stocker le token plain-text dans `pairing_codes` (colonne `device_token`) et le retourner depuis `getPairingStatus`. Invalider (NULLer) la colonne après récupération par la TV.
2. **[Obligatoire]** Ajouter un guard d'authentification Web minimal sur `POST /pairing/codes/:code/approve`, `GET|PATCH|DELETE /devices/*` et `POST /devices/:id/commands`. Un middleware basé sur un secret partagé suffit en attendant #95.
3. **[Recommandé]** Corriger le retour de `getPendingCommands` pour refléter l'état `delivered` après transition.
4. **[Recommandé]** Ajouter le test "revoked device cannot authenticate" dans `devices.test.ts`.
5. **[Mineur]** Supprimer `PairingCodeAlreadyApprovedError` ou l'implémenter réellement.
