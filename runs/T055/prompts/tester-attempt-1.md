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


# T055 — Add secure TV device pairing and remote playback command channel

**Source**: GitHub Issue #104

## Description

## Objective

Add the backend/device foundation that lets an IPTVFlix Android TV app pair securely with the current single-user account and receive remote playback commands from the Web app.

## Product intent

The Android TV client should remain simple. Browsing/choosing content can happen on phone/desktop Web, while the TV acts as a trusted playback target. A user should be able to pair the TV once, then choose a Movie/Episode on Web and send it to that TV.

## Included

- Add a first-class `Device` / playback-target model scoped to the current authenticated IPTVFlix account/profile.
- Implement short-lived TV pairing codes and/or QR-friendly pairing tokens.
- TV can request a pairing code while unauthenticated; an authenticated Web session can approve it.
- After approval, issue a revocable device credential/token suitable for storage on Android TV.
- Add APIs to list, rename and revoke paired devices.
- Add a secure server-side command model for remote playback intents, including at minimum:
  - target device id;
  - canonical Movie/Episode identity;
  - optional explicit Availability id;
  - resume/start position semantics;
  - command id / createdAt / expiry / state.
- Provide a bounded realtime delivery mechanism suitable for Railway + Android TV (WebSocket, SSE/long-poll or equivalent chosen by the Planner) so the TV receives commands quickly without client-to-client direct networking.
- Persist command state enough to survive reconnects/restarts and avoid duplicate playback from the same command.
- Commands must be authenticated/authorized and only deliver to the paired target device.
- Keep provider credentials out of remote-command payloads; the TV should resolve playback through the backend playback boundary from #99.
- Expose device online/last-seen state where practical without requiring a complex presence subsystem.

## Acceptance Criteria

- [ ] A fresh TV can display a short pairing code/QR-compatible token without exposing account secrets.
- [ ] An authenticated Web user can approve pairing and the TV receives a durable revocable device credential.
- [ ] Paired devices can be listed, renamed and revoked from Web/API.
- [ ] A remote playback command can target exactly one paired TV.
- [ ] The target TV can receive the command within a few seconds under normal connectivity.
- [ ] Reconnect/retry does not cause the same command to launch repeatedly.
- [ ] Expired/revoked device credentials cannot receive or acknowledge commands.
- [ ] Command payloads contain canonical/playback-resolution references, not raw Xtream/Plex credentials.
- [ ] Automated tests cover pairing approval, invalid/expired code, device revocation, command authorization, delivery and deduplication.

## Excluded / Out of scope

- Android TV UI/player implementation itself.
- Chromecast/Google Cast protocol compatibility.
- Multi-household accounts.
- Remote volume/TV power control.

## Dependencies

Should integrate with #95 hosted authentication and #99 secure playback resolution. The pairing protocol can be developed in parallel while those contracts settle.