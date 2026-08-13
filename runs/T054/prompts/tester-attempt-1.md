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


# T054 — Add Netflix-style autoplay previews on Home and catalog browsing

**Source**: GitHub Issue #103

## Description

## Objective

Add optional Netflix-style short autoplay previews while browsing Home/catalog/detail surfaces so users can quickly understand a Movie or Series without opening a separate trailer action first.

## Context / Problem

IPTVFlix now has recommendation-backed Shelves/Home and is adding rich detail pages with trailer metadata. The next UX step is lightweight preview playback similar to modern streaming apps: focus/hover/selection can transition a static hero/card into a muted trailer/teaser preview after a deliberate delay.

This must remain controlled, performant and non-annoying, especially on mobile and future TV clients.

## Included

- Reuse canonical trailer/video metadata introduced by the detail/trailer feature; do not perform YouTube searches directly from card components.
- Implement autoplay preview behavior for the Home hero and selected/high-intent catalog surfaces.
- On desktop, support delayed hover/focus preview where appropriate; on touch devices do not emulate hover and avoid surprise autoplay.
- Start previews muted by default and provide clear mute/unmute and replay/open-detail controls where relevant.
- Stop preview immediately when focus/hover/visibility moves away; never allow multiple simultaneous previews.
- Respect browser autoplay restrictions and fall back cleanly to static backdrop/poster when autoplay is denied.
- Respect `prefers-reduced-motion` and expose a user/profile setting to disable autoplay previews.
- Lazy-load/embed preview players only after user intent/delay to avoid loading many YouTube embeds across a Shelf.
- Use a privacy-conscious YouTube embed mode where practical.
- Ensure cards remain usable with keyboard navigation and that preview behavior does not trap focus.
- Define the preview component/API so the future Android TV client can use the same trailer metadata while implementing TV-native focus behavior separately.

## Acceptance Criteria

- [ ] Home hero can transition from backdrop to a muted trailer/teaser preview when a valid preview exists.
- [ ] Supported desktop card/focus interactions can start a preview only after a deliberate delay, not immediately on incidental pointer movement.
- [ ] Only one preview can play at a time and it stops when the item is no longer active/visible.
- [ ] No trailer metadata means the normal static card/hero remains unchanged.
- [ ] Browser autoplay failure does not produce a broken/blank card.
- [ ] Users can disable autoplay previews and reduced-motion preferences are respected.
- [ ] Touch/mobile behavior avoids unwanted automatic video playback.
- [ ] Loading is lazy/bounded; rendering a Shelf does not instantiate a video player for every item.
- [ ] Automated frontend tests cover preview availability, delay/cancel, single-active-player, autoplay-disabled and no-preview fallbacks.

## Excluded / Out of scope

- Generating custom preview clips from full IPTV video streams.
- Hosting/transcoding trailer media.
- Android TV-specific preview implementation.

## Dependencies

Depends on #102 (canonical trailer/video metadata and integrated trailer support). It can use the current Home/Shelf architecture and should remain independent of provider-specific availability.