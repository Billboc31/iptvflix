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


# T132 — Build the Live TV dashboard UI with categories, favorites and EPG-ready cards

**Source**: GitHub Issue #279

## Description

## Context

With a standalone Live TV app and canonicalized channels, IPTVFlix needs the production Live TV dashboard itself.

## Visual target

Use this mockup as the primary UI reference:

![IPTVFlix Live TV target](https://raw.githubusercontent.com/Billboc31/iptvflix/main/CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png)

Source: `CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png` at repository root.

The visual direction is deliberate: dark IPTVFlix shell, **orange** accent, sidebar navigation, top VOD/TV switch, strong channel logos, compact EPG information, horizontal featured rails and dense but readable all-channels list.

## Goal

Implement the Live TV consumer dashboard against canonical channel APIs, closely following the visual hierarchy of the reference screen.

## Required sections

### Top shell

- IPTVFLIX branding.
- VOD / TV switch with TV active in orange.
- Search affordance.
- Current profile/user control reuse where appropriate.

### Sidebar

Include navigation foundation for:

- Accueil TV
- Favoris
- Récemment regardées
- Guide TV
- Toutes les chaînes

And channel categories such as:

- Généralistes
- Sport
- Cinéma & Séries
- Infos
- Enfants
- Musique
- Documentaires
- Divertissement
- International

Categories must come from canonical/data-driven channel category information rather than title-specific hardcoding.

### En direct maintenant

Create a prominent horizontal rail of live channels.

Each card should support:

- channel logo;
- `LIVE` badge;
- current program name where EPG exists;
- program start/end time;
- progress indicator based on current time;
- immediate play action.

If EPG is not yet available, the card still renders cleanly with channel identity and live status.

### Recently watched

Provide a compact rail for recent canonical channels, ready to consume actual history state when available.

If no history exists yet, omit the rail rather than fabricate content.

### Channels by category

Show category shortcut cards with channel counts, following the visual reference.

### All channels

Build a dense searchable/filterable canonical channel list/grid with:

- favorite toggle;
- clean canonical logo/name;
- current/next EPG information where available;
- live progress;
- play action;
- useful filters such as favorites, HD/4K where reliable, French/international/category as data allows.

Do not display raw duplicate `ChannelSource` records to the user.

## EPG readiness

This ticket should be **EPG-ready**, even if full XMLTV/EPG ingestion lands separately.

Define UI contracts/components so `now` / `next` program information, start/end times and progress can be supplied without rewriting channel cards later.

No fake schedules should be used in production UI when EPG data is absent.

## Favorites and history readiness

- Favorite action should target canonical `Channel` identity, not a technical stream source.
- Recently watched/history should also reference canonical channels.
- If the underlying persistence already exists, wire it; otherwise establish clean frontend/domain seams rather than inventing temporary local-only behavior that will need replacement.

## Playback

- Clicking play/channel should launch the preferred stream selected by the canonical channel/source-selection layer.
- UI should not expose provider/source choice in the normal happy path.
- Surface graceful playback failure/retry/fallback behavior.

## Responsive behavior

- Desktop/tablet layout should strongly follow the reference.
- Mobile should collapse sidebar/navigation sensibly while keeping search, categories and channel cards usable.
- Design should remain compatible with future TV/remote focus navigation, even though this ticket targets the Live TV web app.

## Acceptance criteria

- Live TV dashboard visually follows the provided orange/black mockup.
- Top VOD/TV switch and Live TV sidebar are implemented.
- Live channels are shown using canonical channel identities/logos.
- Featured live rail, category shortcuts and all-channels area render from real API data.
- No duplicate provider streams appear as separate cards when canonicalization has grouped them.
- EPG-present and EPG-absent states both render cleanly.
- Favorites/history semantics are canonical-channel based.
- Search/filter works on canonical channel metadata.
- Empty/error/loading states are graceful and isolated by section where appropriate.
- Existing VOD UI is not restyled/regressed by Live TV-specific orange theme.
- Add automated/component tests for major dashboard sections, EPG/no-EPG states, canonical channel rendering, filtering and playback action wiring.
- No channel-specific hacks and no fake production EPG data.