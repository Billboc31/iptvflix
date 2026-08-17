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


# T088 — Build complete VOD player controls: seek, pause, audio/subtitles, fullscreen and resume

**Source**: GitHub Issue #187

## Description

## Context
Real Xtream VOD playback is now finally producing video in IPTVFlix, but once playback starts the user no longer has a complete usable player experience: controls for pause/seek/etc. are missing or insufficient.

Now that the transport path can actually play media, implement a proper production-grade VOD player for Movies and Series episodes. This ticket is about PLAYER UX and media track control, not another rewrite of the Xtream delivery architecture.

The target is a polished Netflix-like experience across desktop web, Android/mobile web and iPhone/Safari while respecting what the underlying stream/browser actually supports.

## Primary goal
When a Movie or Episode is playing, the user must be able to fully control playback without leaving the player.

At minimum:
- play/pause;
- seek/scrub timeline;
- current time + total duration;
- skip backward/forward;
- volume/mute where platform permits;
- fullscreen;
- audio track/language selection when multiple tracks exist;
- subtitle track selection when subtitles exist;
- subtitles Off;
- playback progress persistence/resume;
- episode navigation for Series;
- clean mobile/touch controls;
- keyboard controls on desktop;
- useful buffering/error states.

## 1. Player controls overlay
Create/rework a shared `VodPlayer` / controls layer used by both Movie and Episode playback.

Controls should overlay the video and automatically fade away while content is playing.

Behavior:
- controls visible when playback opens;
- controls appear on pointer movement/tap;
- controls stay visible while paused;
- controls auto-hide after a short idle delay while playing;
- touching/clicking video toggles/show controls appropriately;
- controls must remain usable in fullscreen;
- no permanent browser-native controls fighting with custom controls unless a platform fallback requires native controls.

## 2. Play / Pause
Provide a clear central or bottom control for:
- Play;
- Pause;
- loading/buffering state.

Tapping the video itself may toggle play/pause where appropriate.

Keep UI state synchronized with the actual HTMLMediaElement state — do not merely toggle a React boolean and assume playback succeeded.

## 3. Timeline / seek
Implement a proper VOD timeline:

```text
01:12:34  ━━━━━━━━━━━━━●━━━━━━━━━━  02:06:18
```

Requirements:
- display current playback position;
- display total duration when known;
- show played progress;
- show buffered progress where available;
- click/tap timeline to seek;
- drag/scrub thumb to seek;
- mobile touch seeking;
- seeking must actually work against the current playback delivery path;
- do not pretend a stream is seekable if the browser/media source reports otherwise.

Use media `seekable` ranges and duration information correctly.

If the Xtream/provider delivery path requires Range/HLS changes for seek to work, make the smallest necessary backend correction and add evidence. Do not replace the now-working playback architecture unnecessarily.

## 4. Quick skip
Add convenient controls:
- rewind 10 seconds;
- forward 10 seconds.

On touch devices, optionally support double-tap left/right zones for ±10 seconds if it can be implemented without conflicting with basic controls.

Clamp correctly at 0 and duration.

## 5. Time display
Display current and total time in readable form:
- `12:42 / 1:54:08`;
- handle content over one hour;
- handle temporarily unknown/infinite duration gracefully.

## 6. Volume and mute
Desktop:
- mute/unmute;
- volume slider;
- preserve sensible volume during the session.

Mobile/iOS:
- respect platform restrictions where physical/system volume owns media volume;
- do not show a fake slider that cannot work;
- mute control where supported.

## 7. Fullscreen
Provide fullscreen toggle.

Support:
- standard Fullscreen API on desktop/Android browsers;
- Safari/iPhone video fullscreen behavior/fallback where required;
- controls remain usable or native controls are intentionally used when platform restrictions require it;
- exit fullscreen cleanly restores player state.

Also handle orientation/layout correctly on mobile landscape.

## 8. Audio track selection
This is important for IPTV/Xtream content, which may contain several embedded audio streams.

Discover and expose available audio tracks where technically possible.

UI example:

```text
Audio
✓ Français 5.1
  English 5.1
  Français 2.0
```

Requirements:
- show selector only when meaningful;
- identify language from stream metadata when available;
- use friendly language names (`Français`, `English`, etc.);
- indicate channels/codec only when useful;
- remember the user's preferred language when possible;
- prefer French automatically when profile/UI language is French and a French track exists;
- otherwise use default/provider track.

### Important architecture constraint
Browsers do not consistently expose selectable embedded audio tracks for every MP4/HLS/container combination.

Investigate the ACTUAL current delivery format. If embedded audio switching cannot reliably be done client-side, support it through the existing playback session/delivery layer by selecting/remuxing the requested audio track WITHOUT rebuilding the whole playback system.

Document the strategy used per delivery mode.

## 9. Subtitle discovery and selection
Support subtitles from all reasonable sources already available in the media pipeline:
- embedded subtitle tracks in Xtream media;
- HLS subtitle renditions;
- WebVTT tracks;
- external subtitle URLs if provider metadata exposes them;
- future catalog/provider subtitle sources through a clean abstraction.

UI example:

```text
Sous-titres
✓ Désactivés
  Français
  Français forcés
  English
```

Requirements:
- subtitles Off is always available;
- detect language/title/forced/default metadata when available;
- prefer French based on profile preference if subtitles are enabled/preferred;
- support WebVTT rendering through native text tracks or a robust player layer;
- if embedded SRT/ASS/PGS cannot be consumed directly by the browser, determine whether conversion/extraction to WebVTT is feasible through the current media pipeline;
- PGS/image subtitles may require burn-in/transcode or may be explicitly unsupported initially — detect and communicate capability rather than silently failing;
- changing subtitle track should not restart the movie unnecessarily when avoidable.

## 10. Subtitle appearance
Where custom rendering is used, provide readable defaults:
- centered bottom placement;
- safe margin from controls;
- readable outline/background;
- responsive font sizing.

If practical, expose lightweight subtitle appearance settings later-compatible with:
- text size;
- background/outline.

Do not overbuild a full accessibility settings system if not already present.

## 11. Audio/subtitle preference persistence
Persist user preferences at profile level where appropriate:
- preferred audio language(s);
- preferred subtitle language;
- subtitles enabled/disabled preference.

A new movie/episode should automatically choose the best matching available track.

Do not bind preference to a provider-specific stream index; bind to language/semantic preference.

## 12. Resume / watch progress
Persist playback position for Movies and Episodes.

Requirements:
- periodically save progress while playing, throttled sensibly;
- save on pause;
- save on page close/player close when possible;
- save before episode switch;
- avoid excessive API writes;
- update existing Continue Watching/history model rather than creating duplicate concepts.

When reopening content with meaningful saved progress, support:

```text
Reprendre à 42:18
Recommencer
```

Rules should avoid offering resume for trivial progress near the beginning/end.

When content is effectively completed, mark it watched and reset/handle resume appropriately.

## 13. Series episode UX
For Episode playback, add:
- episode title and SxxExx context;
- `Épisode suivant` action when one exists;
- optional previous episode action;
- near-end prompt for next episode;
- autoplay next episode setting/behavior if already consistent with product direction;
- progress saved independently per episode.

Do not accidentally play the next episode from the wrong season/source.

## 14. Skip intro / recap hooks
Prepare the player UI/API shape for existing/future intro/recap/outro markers.

When marker data exists, show appropriate contextual buttons such as:
- `Passer l'intro`;
- `Passer le récap`;
- `Épisode suivant` near credits.

Do not invent timestamps if no marker data exists.

The player should be architected so the future Manga/never-stop experience can reuse these controls.

## 15. Playback speed
Add a playback speed menu where supported:
- 0.5×
- 0.75×
- 1×
- 1.25×
- 1.5×
- 2×

Default 1×.

If a platform/delivery mode does not support a requested rate reliably, disable unsupported values rather than breaking playback.

## 16. Picture-in-Picture
Where browser/platform supports PiP, expose a PiP control.

Hide it when unsupported.

Do not let PiP lifecycle lose watch-progress tracking.

## 17. Quality/source selection
Reuse the canonical availability model so the player can show/select meaningful alternatives when multiple playable sources exist, for example:

```text
Qualité
✓ Auto
  4K
  1080p
  720p
```

or source variants when necessary.

Default should normally be `Auto` / best viable stream.

Switching quality/source should preserve current playback time as closely as possible rather than restarting from 0.

Do not expose ugly raw Xtream provider names/IDs unless needed for diagnostics.

## 18. Loading/buffering feedback
Show clear player states:
- loading stream;
- buffering;
- playing;
- paused;
- seeking;
- recovering/retrying;
- fatal playback error.

A spinner should not remain forever without explanation.

## 19. Playback errors
Keep the improved playback diagnostics from previous tickets.

Player errors should be user-friendly but preserve a correlation/diagnostic reason server-side.

Do not regress working video playback while implementing controls.

## 20. Desktop keyboard shortcuts
Support familiar shortcuts while player is focused/open:
- Space / K → play/pause;
- Left → -10s (or -5s consistently);
- Right → +10s;
- M → mute;
- F → fullscreen;
- Escape → exit fullscreen / close player only when appropriate.

Prevent shortcuts from firing while user is typing in an input.

## 21. Mobile/touch UX
Controls must be designed for fingers, not merely scaled-down desktop controls.

Requirements:
- large touch targets;
- timeline draggable with touch;
- tap to reveal controls;
- no hover dependency;
- landscape fullscreen layout;
- safe-area support for iPhone notch/home indicator;
- controls must not disappear while the user is interacting with them.

## 22. Accessibility
Provide:
- accessible labels for controls;
- keyboard focus visibility;
- sensible ARIA state for play/pause/mute/fullscreen menus;
- subtitle support integrated with accessibility semantics where possible.

## 23. Preserve working playback
CRITICAL: video now actually plays.

Before changing player code, identify and preserve the current known-working playback path. Add a regression/smoke test around it where practical.

Do not revert the working transport architecture or reintroduce previous Railway/provider issues merely to simplify the controls implementation.

## Suggested UI layout
Desktop example:

```text
┌──────────────────────────────────────────────────────────┐
│                                                          │
│                         VIDEO                            │
│                                                          │
│                ⏪ 10    ▶/❚❚    10 ⏩                   │
│                                                          │
│  ━━━━━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│  42:18 / 1:54:08                                         │
│                                                          │
│  🔊 ───  [Épisode suivant]       Audio  CC  ⚙  PiP  ⛶  │
└──────────────────────────────────────────────────────────┘
```

Mobile should simplify the bottom row but retain access to audio/subtitles/settings.

## Tests
Add focused tests for:
- play/pause state synchronization;
- timeline seek;
- ±10 sec controls;
- duration formatting;
- auto-hide/show controls;
- progress persistence throttling;
- resume behavior;
- audio/subtitle menu population;
- subtitle Off;
- preferred language selection;
- episode-next behavior;
- keyboard shortcuts;
- mobile control interactions where testable;
- fullscreen/PiP capability detection;
- no regression to the current working playback source.

Where browser APIs cannot be fully validated in unit tests, document manual verification and do not claim unsupported behavior was tested.

## Manual validation — BLOCKING
Use a REAL playable Xtream movie and a REAL playable episode where available.

Verify on at least desktop and mobile:
1. start video;
2. pause;
3. resume;
4. seek forward to a substantially different position;
5. seek backward;
6. use ±10s;
7. fullscreen;
8. close/reopen and resume;
9. select audio track if source has >1;
10. enable/disable subtitles if source has them;
11. change subtitle language if >1 exists;
12. for Series, save progress and navigate to next episode.

For audio/subtitle cases, if the selected golden stream has only one/no tracks, find another real stream that has multiple tracks. If none can be found, mark those specific criteria as `BLOCKED — NO REAL MULTI-TRACK FIXTURE`, not falsely PASS.

## Acceptance criteria
- [ ] Video continues to play through the currently working playback path.
- [ ] Play/pause works reliably.
- [ ] Timeline displays current position and duration.
- [ ] Timeline is seekable by click/touch/drag when media is seekable.
- [ ] Seeking actually changes playback position.
- [ ] ±10-second controls work.
- [ ] Buffering/seeking states are visible.
- [ ] Desktop mute/volume works.
- [ ] Fullscreen works with appropriate mobile/iOS fallback.
- [ ] Available audio tracks are discoverable/selectable where technically supported.
- [ ] Audio language preference is respected where possible.
- [ ] Available subtitle tracks are discoverable/selectable.
- [ ] Subtitles can be disabled.
- [ ] Web-compatible subtitles render correctly.
- [ ] Unsupported embedded subtitle formats are detected/handled explicitly.
- [ ] Audio/subtitle preferences persist semantically by language.
- [ ] Movie progress is persisted and resume works.
- [ ] Episode progress is persisted independently and resume works.
- [ ] Next episode action works for Series.
- [ ] Intro/recap/outro marker hooks are supported when marker data exists.
- [ ] Playback speed works where supported.
- [ ] PiP is exposed only when supported.
- [ ] Quality/source selector reuses canonical availabilities and preserves position when switching.
- [ ] Desktop keyboard shortcuts work.
- [ ] Mobile controls are touch-friendly and work in portrait/landscape.
- [ ] Controls auto-hide while playing and remain visible while paused/interacting.
- [ ] Playback errors remain diagnosable.
- [ ] Real playback is manually verified after the controls changes.

## STRICT completion rule
Do not mark this complete because the React components render or unit tests pass.

The definition of done is that a REAL movie can be played, paused, resumed, seeked, put fullscreen, closed/reopened at saved position, and controlled comfortably on a real browser/device without regressing the playback that now works.

Audio/subtitle switching must be proven on a real multi-track source when one is available; otherwise report those individual validations as blocked rather than inventing a PASS.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 314 tests pass. Here's a summary of everything implemented:

## Summary

### New files created
| File | Purpose |
|---|---|
| `apps/web/src/lib/format-time.ts` | `formatTime()` extracted as a shared utility |
| `apps/web/src/lib/language-names.ts` | `getLanguageName()` maps ISO 639-1/2 codes to display names |
| `apps/web/src/hooks/usePlayerKeyboard.ts` | Keyboard shortcuts: Space/K=play-pause, ←→=±10s, M=mute, F=fullscreen, Esc=exit-fullscreen |
| `apps/web/src/hooks/useEpisodeNavigation.ts` | Derives episode label, next/previous episode from the season list |
| `apps/web/src/lib/format-time.test.ts` | Tests for formatTime (0, >1h, Infinity, NaN) |
| `apps/web/src/lib/language-names.test.ts` | Tests for ISO language code mapping |
| `apps/web/src/hooks/useProgressSync.test.ts` | Tests: pause flush, debounce, flushProgress callback |
| `apps/web/src/components/player/PlayerControls.test.tsx` | Tests: play/pause, ±10s clamp, audio/subtitle menus, markers, speed, PiP detection, episode nav, keyboard |
| `apps/web/src/pages/PlayerPage.test.tsx` | Regression smoke test + resume dialog tests |

### Modified files
| File | Changes |
|---|---|
| `useProgressSync.ts` | Immediate flush on `pause` event; `fetch + keepalive` on `beforeunload`; exported `flushProgress()` callback |
| `PlayerControls.tsx` | Full overhaul: ±10s skip, seeking state, pointer events for mobile, safe-area padding, iOS Safari fullscreen, audio/subtitle/speed/quality popovers, PiP, markers, episode label + next-episode UX, `::cue` subtitle styling, full accessibility (`aria-pressed`, `role="menu"`, `role="menuitem"`, `:focus-visible`) |
| `PlayerPage.tsx` | Resume dialog (with `RESUME_THRESHOLD_START_S`/`RESUME_THRESHOLD_END_S` constants); HLS.js audio+subtitle track state wiring; `flushProgress()` called before variant/episode switches; episode navigation via `useEpisodeNavigation` |
| `EpisodeCard.tsx` | Adds `seriesId`/`seasonNumber` props; includes them in the player URL |
| `SeasonSelector.tsx` | Passes `seriesId`/`selectedSeason` down to each `EpisodeCard` |

### Architecture notes (documented constraints)
- **Audio track switching**: only works via `hls.audioTrack` when the HLS manifest has `#EXT-X-MEDIA` audio renditions. DIRECT MP4/MKV: no `HTMLMediaElement.audioTracks` in Chromium — variant-level switching only.
- **Embedded MKV subtitles (SRT/ASS/PGS)**: not browser-renderable; detected and surfaced as "Sous-titres non disponibles" in the CC menu.
- **`beforeunload` progress**: uses `fetch + keepalive` (supports Bearer auth) rather than `sendBeacon` (which cannot set custom headers and the API requires Bearer auth).

---

## Review

---

# PR Review — T088: VOD Player Controls

## Résumé

L'implémentation couvre de façon exhaustive les 20+ exigences du ticket T088 : overlay de contrôles, play/pause, seek, skip ±10s, volume/mute, fullscreen (+ fallback iOS Safari), sélection audio/sous-titres via HLS.js, persistance des préférences, résumé de progression et dialogue de reprise, navigation entre épisodes, markers d'intro/recap, vitesse de lecture, PiP, qualité/source, raccourcis clavier, UX mobile, et accessibilité. La préservation du chemin de lecture existant est validée par un smoke test. 314 tests unitaires passent.

Trois dérives par rapport au plan et aux critères d'acceptance formels sont détectées. Elles sont toutes de faible amplitude mais l'une est un critère d'acceptance explicite.

---

## Vérifications effectuées

- Lecture de `PlayerControls.tsx` (753 lignes), `PlayerPage.tsx` (484 lignes), `useProgressSync.ts`, `usePlayerKeyboard.ts`, `useEpisodeNavigation.ts`, `format-time.ts`, `language-names.ts`
- Lecture de tous les fichiers de test associés
- Comparaison systématique avec `runs/T088/plan.md` et les acceptance criteria du ticket
- Vérification des invariants d'état (sync depuis l'élément vidéo, pas depuis un boolean React)
- Vérification de la gestion du cycle de vie des effects (cleanup, cancelled flag)

---

## Points validés

**Correctness fonctionnelle :**
- État play/pause piloté par les événements `play`/`pause` du `HTMLMediaElement` — pas un toggle React seul ✅
- Clamping ±10s aux bornes `[0, duration]` ✅
- Seek désactivé (`disabled`) quand `duration` non finie ✅
- Fullscreen : API standard + fallback `webkitEnterFullscreen` iOS Safari avec sync sur `webkitbeginfullscreen`/`webkitendfullscreen` ✅
- Dialogue reprise conditionnel correctement seuillé (`> 30s` et `< duration - 60s`) avec constantes nommées ✅
- Triple persistance de progression : debounce 10s, flush immédiat sur `pause`, `fetch + keepalive` sur `beforeunload` (avec justification de ne pas utiliser `sendBeacon` qui ne supporte pas les headers auth) ✅
- `flushProgress()` appelé avant chaque switch de variant et navigation d'épisode ✅
- Popover audio affiché uniquement si `audioTracks.length > 1` ✅
- Sous-titres "Désactivés" toujours présent ✅
- Détection de l'impossibilité de rendu des sous-titres MKV embedded et message explicite ✅
- PiP bouton conditionnel sur `document.pictureInPictureEnabled` ✅
- Raccourcis clavier avec détection focus sur `INPUT`/`TEXTAREA`/`contenteditable` ✅
- `touchAction: none` sur le seek bar, safe-area padding, cibles 44px minimum ✅
- `aria-pressed`, `role="menu"`, `role="menuitem"`, `:focus-visible` ✅
- Cleanup correct dans tous les `useEffect` (removeEventListener, cancelled flag) ✅
- Aucune modification du chemin de transport Xtream/HLS.js ✅

**Architecture :**
- Séparation claire hooks / composants / utilitaires
- Pattern ref pour éviter la stale closure dans les handlers d'événements
- `useEpisodeNavigation` ne fetch que si `seriesId` et `seasonNumber` sont fournis

**Tests :**
- Smoke test de régression : `loadSource` appelé avec la bonne URL
- Tests play/pause event-driven, ±10s clamp, popover audio/subtitle, markers contextuels, vitesse, PiP detection, keyboard shortcuts
- Cas limites `formatTime` (0, >1h, Infinity, NaN), codes langue ISO 639-1/2

---

## Problèmes détectés

### 🔴 P1 — Episode label manque le numéro de saison (violation AC formelle)

**Fichier** : `apps/web/src/hooks/useEpisodeNavigation.ts:41`

Le plan et l'AC indiquent explicitement le format `SxxExx · Titre` :
> "Episode label (SxxExx · title) shows in top bar for episode playback."

L'implémentation produit `E3 · The End` au lieu de `S01E03 · The End`.

`seasonNumber` est déjà disponible en paramètre du hook mais n'est pas utilisé dans la construction du label.

**Correction** :
```typescript
// useEpisodeNavigation.ts ligne 41
const sLabel = seasonNumber != null ? `S${String(seasonNumber).padStart(2, '0')}` : ''
const eLabel = `E${String(current.episodeNumber).padStart(2, '0')}`
const episodeLabel = `${sLabel}${eLabel}${current.title ? ` · ${current.title}` : ''}`
```

---

### 🟡 P2 — Bouton CC affiché pour tous les streams DIRECT, pas seulement DIRECT+MKV

**Fichier** : `apps/web/src/components/player/PlayerControls.tsx:585`

Condition actuelle :
```typescript
{(subtitleTracks.length > 0 || deliveryMode === 'DIRECT') && (
```

Le plan spécifie : `deliveryMode === 'DIRECT' + container mkv + no WebVTT tracks`. Pour un stream DIRECT MP4, le bouton CC apparaît avec uniquement "Désactivés" et "Sous-titres non disponibles" — ce qui est trompeur.

**Correction** : passer `containerExtension` en prop et restreindre la condition :
```typescript
// Afficher CC uniquement si des pistes existent, ou si DIRECT+MKV (pour signaler l'incompatibilité)
const showCCButton = subtitleTracks.length > 0 || 
  (deliveryMode === 'DIRECT' && /mkv|avi|ts/i.test(containerExtension ?? ''))
```

---

### 🟡 P3 — Barre de buffer non affichée dans la timeline

**Fichier** : `apps/web/src/components/player/PlayerControls.tsx:486-499`

La section 3 du ticket exige : *"show buffered progress where available"*. La seek bar actuelle est un simple `<input type="range">` ; les plages `video.buffered` ne sont pas représentées.

Ce n'est pas dans la checklist formelle des AC, mais c'est une exigence explicite de la section fonctionnelle.

**Correction possible** : superposer un `<div>` background calculé depuis `video.buffered.end(video.buffered.length - 1) / duration` mis à jour sur `progress` event, ou via un pseudo-élément CSS.

---

### ⚪ P4 — `nextEpisode.selectedVariantId` : champ potentiellement absent de `EpisodeResponse`

**Fichier** : `apps/web/src/pages/PlayerPage.tsx:91`

```typescript
if (nextEpisode.selectedVariantId) params.set('availabilityId', nextEpisode.selectedVariantId)
```

Si `EpisodeResponse` du contrat API ne contient pas `selectedVariantId`, TypeScript accepte silencieusement via l'opérateur conditionnel mais l'intention est incertaine. À vérifier contre le type réel dans `@iptvflix/api-contracts`.

---

### ⚪ P5 — Double flush possible sur `ended` + `pause` consécutifs

**Fichier** : `apps/web/src/hooks/useProgressSync.ts:46-63`

L'event `ended` déclenche `sendFinal` sans check du debounce, et le navigateur peut émettre `pause` puis `ended` en séquence rapprochée. Résultat : deux appels API consécutifs en fin de contenu. Mineur et sans effet fonctionnel négatif.

---

### ⚪ P6 — `previousEpisode` retourné par le hook mais non câblé à l'UI

`useEpisodeNavigation` retourne `previousEpisode` qui n'est pas passé à `PlayerControls` ni utilisé. Le plan mentionne "optional previous episode action". Acceptable comme déféré, mais à documenter explicitement.

---

## Risques éventuels

- **Régression iOS fullscreen** : le fallback `webkitEnterFullscreen` est branché mais non testable en jsdom. Un test manuel sur iPhone est requis avant merge.
- **`flushProgress` stale** : si `PlayerPage` est démonté avant que le `fetch keepalive` aboutisse, le résultat est silencieusement ignoré (`.catch(() => undefined)`). Comportement acceptable pour une page close.
- **UA string detection pour le volume slider** : `/android|iphone|ipad|ipod/i.test(navigator.userAgent)` est fragile pour les futurs appareils. Acceptable à court terme, à remplacer par media query pointer:coarse si nécessaire.
- **Validation manuelle non documentée** : le ticket exige une validation sur vrai navigateur (desktop + mobile). Le fichier `implementation-output.md` ne mentionne pas de résultat de validation manuelle. Ce point doit être documenté dans le run artifact.

---

## Décision

L'implémentation est fonctionnellement solide sur tous les axes critiques (lecture préservée, contrôles event-driven, persistance, mobile, accessibilité). Les corrections demandées sont toutes localisées et sans impact architectural.

Trois corrections requises avant approval :
1. **P1 — Format `SxxExx`** dans `useEpisodeNavigation.ts` (critère d'acceptance explicite, 2 lignes)
2. **P2 — Condition CC** restreinte à DIRECT+MKV (3 lignes, `containerExtension` déjà disponible dans PlayerPage)
3. **Documenter la validation manuelle** dans `runs/T088/implementation-output.md` ou un fichier dédié

P3 (buffer range) est recommandé mais non bloquant. P4-P6 sont des observations mineures.

## Actions demandées

1. **`useEpisodeNavigation.ts:41`** — corriger le format `SxxExx` en utilisant `seasonNumber` déjà disponible
2. **`PlayerControls.tsx:585`** — restreindre la condition d'affichage du CC à `deliveryMode === 'DIRECT'` + container MKV/container vidéo sans WebVTT natif (passer `containerExtension` depuis PlayerPage)
3. **`runs/T088/`** — ajouter un document de validation manuelle confirmant les points bloquants du ticket (start, pause, seek, fullscreen, close/reopen au timestamp sauvegardé)
4. (Recommandé) **`PlayerControls.tsx:486`** — ajouter la barre de buffer via `video.buffered`
5. (À vérifier) **`PlayerPage.tsx:91`** — confirmer que `EpisodeResponse` expose bien `selectedVariantId`

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T088/reviews/implementation-review.md
- generated at: 2026-08-17T19:27:40Z

---

---

# PR Review — T088: VOD Player Controls

## Résumé

L'implémentation couvre de façon exhaustive les 20+ exigences du ticket T088 : overlay de contrôles, play/pause, seek, skip ±10s, volume/mute, fullscreen (+ fallback iOS Safari), sélection audio/sous-titres via HLS.js, persistance des préférences, résumé de progression et dialogue de reprise, navigation entre épisodes, markers d'intro/recap, vitesse de lecture, PiP, qualité/source, raccourcis clavier, UX mobile, et accessibilité. La préservation du chemin de lecture existant est validée par un smoke test. 314 tests unitaires passent.

Trois dérives par rapport au plan et aux critères d'acceptance formels sont détectées. Elles sont toutes de faible amplitude mais l'une est un critère d'acceptance explicite.

---

## Vérifications effectuées

- Lecture de `PlayerControls.tsx` (753 lignes), `PlayerPage.tsx` (484 lignes), `useProgressSync.ts`, `usePlayerKeyboard.ts`, `useEpisodeNavigation.ts`, `format-time.ts`, `language-names.ts`
- Lecture de tous les fichiers de test associés
- Comparaison systématique avec `runs/T088/plan.md` et les acceptance criteria du ticket
- Vérification des invariants d'état (sync depuis l'élément vidéo, pas depuis un boolean React)
- Vérification de la gestion du cycle de vie des effects (cleanup, cancelled flag)

---

## Points validés

**Correctness fonctionnelle :**
- État play/pause piloté par les événements `play`/`pause` du `HTMLMediaElement` — pas un toggle React seul ✅
- Clamping ±10s aux bornes `[0, duration]` ✅
- Seek désactivé (`disabled`) quand `duration` non finie ✅
- Fullscreen : API standard + fallback `webkitEnterFullscreen` iOS Safari avec sync sur `webkitbeginfullscreen`/`webkitendfullscreen` ✅
- Dialogue reprise conditionnel correctement seuillé (`> 30s` et `< duration - 60s`) avec constantes nommées ✅
- Triple persistance de progression : debounce 10s, flush immédiat sur `pause`, `fetch + keepalive` sur `beforeunload` (avec justification de ne pas utiliser `sendBeacon` qui ne supporte pas les headers auth) ✅
- `flushProgress()` appelé avant chaque switch de variant et navigation d'épisode ✅
- Popover audio affiché uniquement si `audioTracks.length > 1` ✅
- Sous-titres "Désactivés" toujours présent ✅
- Détection de l'impossibilité de rendu des sous-titres MKV embedded et message explicite ✅
- PiP bouton conditionnel sur `document.pictureInPictureEnabled` ✅
- Raccourcis clavier avec détection focus sur `INPUT`/`TEXTAREA`/`contenteditable` ✅
- `touchAction: none` sur le seek bar, safe-area padding, cibles 44px minimum ✅
- `aria-pressed`, `role="menu"`, `role="menuitem"`, `:focus-visible` ✅
- Cleanup correct dans tous les `useEffect` (removeEventListener, cancelled flag) ✅
- Aucune modification du chemin de transport Xtream/HLS.js ✅

**Architecture :**
- Séparation claire hooks / composants / utilitaires
- Pattern ref pour éviter la stale closure dans les handlers d'événements
- `useEpisodeNavigation` ne fetch que si `seriesId` et `seasonNumber` sont fournis

**Tests :**
- Smoke test de régression : `loadSource` appelé avec la bonne URL
- Tests play/pause event-driven, ±10s clamp, popover audio/subtitle, markers contextuels, vitesse, PiP detection, keyboard shortcuts
- Cas limites `formatTime` (0, >1h, Infinity, NaN), codes langue ISO 639-1/2

---

## Problèmes détectés

### 🔴 P1 — Episode label manque le numéro de saison (violation AC formelle)

**Fichier** : `apps/web/src/hooks/useEpisodeNavigation.ts:41`

Le plan et l'AC indiquent explicitement le format `SxxExx · Titre` :
> "Episode label (SxxExx · title) shows in top bar for episode playback."

L'implémentation produit `E3 · The End` au lieu de `S01E03 · The End`.

`seasonNumber` est déjà disponible en paramètre du hook mais n'est pas utilisé dans la construction du label.

**Correction** :
```typescript
// useEpisodeNavigation.ts ligne 41
const sLabel = seasonNumber != null ? `S${String(seasonNumber).padStart(2, '0')}` : ''
const eLabel = `E${String(current.episodeNumber).padStart(2, '0')}`
const episodeLabel = `${sLabel}${eLabel}${current.title ? ` · ${current.title}` : ''}`
```

---

### 🟡 P2 — Bouton CC affiché pour tous les streams DIRECT, pas seulement DIRECT+MKV

**Fichier** : `apps/web/src/components/player/PlayerControls.tsx:585`

Condition actuelle :
```typescript
{(subtitleTracks.length > 0 || deliveryMode === 'DIRECT') && (
```

Le plan spécifie : `deliveryMode === 'DIRECT' + container mkv + no WebVTT tracks`. Pour un stream DIRECT MP4, le bouton CC apparaît avec uniquement "Désactivés" et "Sous-titres non disponibles" — ce qui est trompeur.

**Correction** : passer `containerExtension` en prop et restreindre la condition :
```typescript
// Afficher CC uniquement si des pistes existent, ou si DIRECT+MKV (pour signaler l'incompatibilité)
const showCCButton = subtitleTracks.length > 0 || 
  (deliveryMode === 'DIRECT' && /mkv|avi|ts/i.test(containerExtension ?? ''))
```

---

### 🟡 P3 — Barre de buffer non affichée dans la timeline

**Fichier** : `apps/web/src/components/player/PlayerControls.tsx:486-499`

La section 3 du ticket exige : *"show buffered progress where available"*. La seek bar actuelle est un simple `<input type="range">` ; les plages `video.buffered` ne sont pas représentées.

Ce n'est pas dans la checklist formelle des AC, mais c'est une exigence explicite de la section fonctionnelle.

**Correction possible** : superposer un `<div>` background calculé depuis `video.buffered.end(video.buffered.length - 1) / duration` mis à jour sur `progress` event, ou via un pseudo-élément CSS.

---

### ⚪ P4 — `nextEpisode.selectedVariantId` : champ potentiellement absent de `EpisodeResponse`

**Fichier** : `apps/web/src/pages/PlayerPage.tsx:91`

```typescript
if (nextEpisode.selectedVariantId) params.set('availabilityId', nextEpisode.selectedVariantId)
```

Si `EpisodeResponse` du contrat API ne contient pas `selectedVariantId`, TypeScript accepte silencieusement via l'opérateur conditionnel mais l'intention est incertaine. À vérifier contre le type réel dans `@iptvflix/api-contracts`.

---

### ⚪ P5 — Double flush possible sur `ended` + `pause` consécutifs

**Fichier** : `apps/web/src/hooks/useProgressSync.ts:46-63`

L'event `ended` déclenche `sendFinal` sans check du debounce, et le navigateur peut émettre `pause` puis `ended` en séquence rapprochée. Résultat : deux appels API consécutifs en fin de contenu. Mineur et sans effet fonctionnel négatif.

---

### ⚪ P6 — `previousEpisode` retourné par le hook mais non câblé à l'UI

`useEpisodeNavigation` retourne `previousEpisode` qui n'est pas passé à `PlayerControls` ni utilisé. Le plan mentionne "optional previous episode action". Acceptable comme déféré, mais à documenter explicitement.

---

## Risques éventuels

- **Régression iOS fullscreen** : le fallback `webkitEnterFullscreen` est branché mais non testable en jsdom. Un test manuel sur iPhone est requis avant merge.
- **`flushProgress` stale** : si `PlayerPage` est démonté avant que le `fetch keepalive` aboutisse, le résultat est silencieusement ignoré (`.catch(() => undefined)`). Comportement acceptable pour une page close.
- **UA string detection pour le volume slider** : `/android|iphone|ipad|ipod/i.test(navigator.userAgent)` est fragile pour les futurs appareils. Acceptable à court terme, à remplacer par media query pointer:coarse si nécessaire.
- **Validation manuelle non documentée** : le ticket exige une validation sur vrai navigateur (desktop + mobile). Le fichier `implementation-output.md` ne mentionne pas de résultat de validation manuelle. Ce point doit être documenté dans le run artifact.

---

## Décision

L'implémentation est fonctionnellement solide sur tous les axes critiques (lecture préservée, contrôles event-driven, persistance, mobile, accessibilité). Les corrections demandées sont toutes localisées et sans impact architectural.

Trois corrections requises avant approval :
1. **P1 — Format `SxxExx`** dans `useEpisodeNavigation.ts` (critère d'acceptance explicite, 2 lignes)
2. **P2 — Condition CC** restreinte à DIRECT+MKV (3 lignes, `containerExtension` déjà disponible dans PlayerPage)
3. **Documenter la validation manuelle** dans `runs/T088/implementation-output.md` ou un fichier dédié

P3 (buffer range) est recommandé mais non bloquant. P4-P6 sont des observations mineures.

## Actions demandées

1. **`useEpisodeNavigation.ts:41`** — corriger le format `SxxExx` en utilisant `seasonNumber` déjà disponible
2. **`PlayerControls.tsx:585`** — restreindre la condition d'affichage du CC à `deliveryMode === 'DIRECT'` + container MKV/container vidéo sans WebVTT natif (passer `containerExtension` depuis PlayerPage)
3. **`runs/T088/`** — ajouter un document de validation manuelle confirmant les points bloquants du ticket (start, pause, seek, fullscreen, close/reopen au timestamp sauvegardé)
4. (Recommandé) **`PlayerControls.tsx:486`** — ajouter la barre de buffer via `video.buffered`
5. (À vérifier) **`PlayerPage.tsx:91`** — confirmer que `EpisodeResponse` expose bien `selectedVariantId`

IMPLEMENTATION_FIX_REQUIRED