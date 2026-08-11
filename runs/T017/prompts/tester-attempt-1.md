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


# T017 — Normalize media availability variants by language, subtitles and quality

**Source**: GitHub Issue #34

## Description

## Objective

Represent multiple provider entries for the same canonical work as distinct playback availabilities/variants with normalized language and quality attributes, so the catalog presents one work instead of duplicate cards.

## Context / Problem

A provider may expose the same film/episode several times, for example `FRENCH`, `TRUEFRENCH`, `MULTI`, `VOSTFR`, `1080p`, `2160p`, HDR or other release tags. These are not separate works. IPTVFlix must preserve each usable stream while grouping them under one canonical Media identity.

## Included

- Extend the existing title normalization/matching output to extract availability-specific attributes without destroying `rawTitle`.
- Normalize audio language hints to standard language codes where evidence is reliable (for example FR/FRENCH/TRUEFRENCH → French audio semantics, ENG/ENGLISH → English; MULTI must not be treated as a specific single language unless actual language data proves it).
- Normalize subtitle hints such as VOSTFR separately from audio language.
- Normalize useful video-quality/version hints such as 720p/1080p/2160p/4K and HDR/Dolby Vision where reliably derivable.
- Keep uncertain/unknown attributes explicit rather than guessing.
- Associate all matched variants with the same canonical Movie/Episode.
- Expose variants through canonical detail/API contracts while catalog/list responses remain deduplicated by canonical Media.
- Preserve source identity and provider item identity for every variant.

## Acceptance Criteria

- [ ] Multiple provider entries matched to the same work produce one canonical catalog item with multiple availabilities/variants.
- [ ] Raw provider titles remain preserved for diagnostics/reprocessing.
- [ ] Audio language, subtitle language and video quality are distinct normalized attributes.
- [ ] `VOSTFR` is not incorrectly represented as French audio.
- [ ] `MULTI` is represented without falsely asserting languages that are not known.
- [ ] Unknown/ambiguous language or quality data remains unknown rather than being guessed.
- [ ] Catalog cards/search results are not duplicated merely because language or quality differs.
- [ ] Detail API can expose all usable variants for manual selection.
- [ ] Tests cover common French/English/MULTI/VOSTFR markers, quality markers, ambiguous tags and duplicate-work variants.

## Excluded / Out of scope

- Choosing the user's preferred variant automatically.
- Media player implementation.
- Audio/subtitle probing of stream bytes unless already available cheaply from provider metadata.
- Replacing canonical matching logic from Batch 2.

## Dependencies

Builds on #33 and the existing T011 title normalization/canonical matching pipeline.