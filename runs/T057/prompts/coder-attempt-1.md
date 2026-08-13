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

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

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

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T057 — Add Web 'Play on TV' device picker and remote handoff UX

**Source**: GitHub Issue #106

## Description

## Objective

Let a user choose a Movie/Episode on the IPTVFlix Web app from phone or desktop and hand playback off to a paired Android TV in one action.

## Product intent

The Web app remains the rich browsing/discovery interface. Android TV is a simple playback companion. The handoff should feel immediate: choose media on Web → `Play on TV` → select paired TV if needed → TV starts playback.

## Included

- Add a `Play on TV` action to relevant Movie/Episode detail/play surfaces once at least one paired playback device exists.
- Add a lightweight paired-device picker showing human-readable device names and online/last-seen state from #104.
- If exactly one suitable TV is paired, allow a fast one-tap handoff while still making the target visible/understandable.
- Send remote playback commands through the authenticated backend device-command API; do not attempt browser-to-TV direct network connections.
- Reuse the same canonical Movie/Episode identity and optional explicit Availability choice used by #99.
- Support `Play from beginning` and `Resume` semantics when stored progress exists.
- Show clear command lifecycle feedback in Web: sending, delivered/accepted, failed/expired, device offline.
- Add a simple device-management/pairing surface reachable from Web settings where the user can enter/approve the code shown on TV and rename/revoke devices.
- Preserve the normal `Play here` Web action; remote handoff is an additional playback target, not a replacement.
- Keep the interaction responsive on mobile Web so a phone is a practical remote/browsing companion.

## Acceptance Criteria

- [ ] Web can approve/pair a TV using the code/token flow from #104.
- [ ] Paired TVs are visible by friendly name and can be renamed/revoked.
- [ ] A Movie detail can send `Play on TV` to a selected paired TV.
- [ ] An Episode can be handed off with the correct canonical episode identity.
- [ ] Resume/from-start selection is preserved in the command.
- [ ] One paired device supports a low-friction one-tap handoff path.
- [ ] Offline/revoked/expired targets produce a clear UI state and do not silently succeed.
- [ ] Web still supports local Web playback independently.
- [ ] Frontend tests cover pairing approval, device selection, one-device fast path, resume handoff and offline/error states.

## Excluded / Out of scope

- Using the Web browser as a full remote-control surface for seek/volume after playback starts.
- Chromecast/Google Cast SDK integration.
- Full Android TV browsing interface.

## Dependencies

Depends on #104 device pairing/remote commands. Integrates with #99 playback semantics and #105 Android TV consumption.