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