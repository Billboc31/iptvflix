# T032 — chore(web): expose Vite dev server sur 0.0.0.0 pour accès réseau local / Tailscale

**Source**: GitHub Issue #67

## Description

## Contexte

Le serveur de développement Vite est actuellement lié à `127.0.0.1`, ce qui le rend inaccessible depuis d'autres appareils sur le réseau (ex. iPhone via Tailscale).

## Comportement attendu

Le frontend doit être accessible depuis n'importe quel appareil atteignant la machine via son adresse Tailscale ou IP locale, sans modifier le port (`5174`).

## Travail demandé

- Modifier `apps/web/vite.config.ts` pour que le serveur Vite écoute sur `0.0.0.0` (option `server.host`).
- Vérifier que le proxy `/api` continue de fonctionner correctement.
- S'assurer qu'aucune régression n'est introduite sur les tests existants.

## Critères d'acceptation

- `http://<tailscale-ip>:5174` répond depuis un appareil distant.
- Les tests E2E et unitaires existants passent toujours.
