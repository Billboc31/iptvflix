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