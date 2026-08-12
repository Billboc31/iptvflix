## Objective

Exposer le serveur de développement Vite sur `0.0.0.0` plutôt que `127.0.0.1` afin que le frontend soit accessible depuis des appareils distants (iPhone via Tailscale, autre machine sur le réseau local) sans changer le port ni casser le proxy `/api`.

## Included

- `apps/web/vite.config.ts` : ajouter `host: '0.0.0.0'` dans le bloc `server`, à côté de `port` et `strictPort`.

## Excluded

- Modification du port (`5174` mentionné dans le ticket — le fichier utilise `VITE_DEV_PORT` avec fallback `5173` ; le port n'est pas dans le scope de ce ticket).
- Changement de la configuration de production (Vite `build`).
- Configuration réseau Tailscale ou firewall.
- Ajout de nouveaux tests.

## Acceptance criteria

- `apps/web/vite.config.ts` contient `host: '0.0.0.0'` dans le bloc `server`.
- Le proxy `/api` est inchangé (même `target` et `rewrite`).
- La suite de tests existante (`vitest`, `playwright` si présents) passe sans régression.
- `vite dev` démarre et Vite affiche bien `Network: http://<ip>:517x` dans sa sortie console.
