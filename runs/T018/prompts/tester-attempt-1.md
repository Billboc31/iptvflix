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


# T018 — Add profile playback preferences and deterministic best-availability selection

**Source**: GitHub Issue #35

## Description

## Objective

Allow IPTVFlix to select the best available version of a Movie/Episode for the current profile using explicit language, subtitle, quality and source preferences while still allowing manual variant choice.

## Context / Problem

Once one canonical work can have several Xtream/Plex/language/quality variants, the UI should not force users to inspect every provider entry. The default Play action needs a deterministic, explainable resolver based on profile preferences. UI locale must not be treated as identical to playback-language preference.

## Included

- Add profile-level playback preferences for preferred audio languages, subtitle languages, source priority and quality capabilities/preferences where appropriate.
- Keep UI locale separate from playback-language preferences.
- Implement a backend/domain availability resolver that ranks currently usable variants deterministically.
- Prefer explicit evidence; variants with unknown metadata remain candidates/fallbacks rather than being silently discarded.
- Return the selected/default availability plus alternative variants and enough reason/provenance for UI explanation/debugging.
- Add web settings controls for these preferences and variant selection on media details where multiple variants exist.
- Ensure frontend clients do not independently reimplement ranking rules.

## Acceptance Criteria

- [ ] A French UI can be configured to prefer English audio + French subtitles, proving UI locale and playback preferences are independent.
- [ ] A profile can express ordered audio-language preferences and source priority.
- [ ] The backend deterministically selects one preferred availability when multiple usable variants exist.
- [ ] Higher quality does not automatically override an explicitly higher-priority language/source preference unless the documented ranking rules say so.
- [ ] Alternative variants remain accessible to the user.
- [ ] Unknown metadata has deterministic fallback behavior.
- [ ] Unavailable/stale variants cannot be selected as the preferred playable availability.
- [ ] Automated tests cover language, subtitle, quality, source-priority, unknown metadata and no-availability cases.

## Excluded / Out of scope

- Actual video playback.
- Automatic bandwidth measurement/adaptive streaming.
- Per-device preference synchronization beyond the existing profile model.

## Dependencies

Requires normalized variants from #34 and builds on the profile foundation introduced by the watchlist/history work.