# T114 — Interaction Persistence Audit

**Date:** 2026-08-19
**Scope:** All user-facing actions visible from the IPTVFlix client; tracks the canonical event/state persisted and whether it feeds profile taste or ranking.

---

## Classification key

| Label | Meaning |
|-------|---------|
| ✅ Positive taste | Action accumulates positive weight into taste signals (genre, keyword, people, etc.) |
| ❌ Negative taste | Action accumulates negative weight into taste signals |
| 📝 Recorded only | Event is persisted to `profile_interaction_events` or `viewing_progress` but does not directly influence taste scoring |
| ⚠️ Gap | Action is not persisted or not yet wired to taste/ranking — needs follow-up |

---

## Audit table

| # | User action | Canonical storage | Taste effect | Notes |
|---|-------------|-------------------|--------------|-------|
| 1 | **Play started** | `profile_interaction_events` (`PLAY_STARTED`) | 📝 Recorded only | Used to compute `completionRate` (ratio of starts to completions) but does not directly accumulate genre/keyword scores. |
| 2 | **Meaningful watch progress** (≥ 5% and < 90%) | `viewing_progress` (`IN_PROGRESS_VIEW`) | ✅ Positive taste (+0.5 weight) | `buildTaste` accumulates genre/keyword/language/decade/people via `accumulateMediaFeatures`. Episode → parent series resolution applies. |
| 3 | **Completed** (≥ 90% progress) | `viewing_progress` (`COMPLETED_VIEW`) + `profile_interaction_events` (`PLAY_COMPLETED`) | ✅ Positive taste (+1.0 weight) | Strongest implicit positive signal. `positiveMediaIds` set includes the mediaId. `completionRate` incremented. |
| 4 | **Resume** (subsequent play on same media) | `viewing_progress` (progress updated) | ✅ Positive taste (same as progress weight) | No dedicated resume event; progress row is updated in-place. Second resume at ≥ 5% re-counts as `IN_PROGRESS_VIEW`. |
| 5 | **Like** | `explicit_feedback` (`LIKE`) | ✅ Positive taste (+3.0 weight) | Strongest explicit positive signal. Adds to `positiveMediaIds`. |
| 6 | **Dislike** | `explicit_feedback` (`DISLIKE`) | ❌ Negative taste (−3.0 weight) | Adds to `negativeMediaIds` AND `dislikedMediaIds`. Reranker applies −2.0 penalty (T114). |
| 7 | **Not interested** | `explicit_feedback` (`NOT_INTERESTED`) | ❌ Negative taste (−2.0 weight) | Adds to `negativeMediaIds` AND `notInterestedMediaIds`. Reranker applies −1.2 penalty (T114). |
| 8 | **Add to My List** | `watchlist` (insert) | ✅ Positive taste (+0.5 weight) | `buildTaste` calls `accumulateMediaFeatures` for watchlist entries. Treated as intent signal, weaker than completion. |
| 9 | **Remove from My List** | `watchlist` (delete) | ⚠️ Gap | Deletion from watchlist is not separately processed; the next `buildTaste` rebuild will omit the removed entry, so its contribution disappears on the next rebuild. No dedicated negative signal is stored for removal. |
| 10 | **Search** | ⚠️ Gap | ⚠️ Gap | Search queries are not yet persisted to `profile_interaction_events`. No taste signal derived from search. Tracked as a gap for a future intent-signal ticket. |
| 11 | **Shelf impression/exposure** | `profile_media_exposure` (exposure count incremented) | 📝 Recorded only | Used by hybrid reranker repetition penalty (`−0.05 × min(n, 4)`). Does not feed genre/keyword taste. |
| 12 | **Item click / open detail** | `profile_interaction_events` (`DETAIL_OPENED`) | 📝 Recorded only | Recorded but not currently weighted in `buildTaste`. Classified as weak intent signal — future work may add a small positive weight. |
| 13 | **Play from shelf** | `profile_interaction_events` (`PLAY_STARTED`) + `viewing_progress` | ✅ Positive taste (via play progress) | The play itself feeds taste via `viewing_progress` once meaningful progress accumulates. The shelf source is not separately distinguished. |
| 14 | **Dismiss from Continue Watching** | `continue_watching_dismissals` (insert) | ⚠️ Gap | Dismissal is stored but `buildTaste` does not currently read from `continue_watching_dismissals`. The incomplete progress row remains and may still contribute `IN_PROGRESS_VIEW` weight. Tracked as a gap. |

---

## Gap summary

| Gap | Severity | Recommendation |
|-----|----------|----------------|
| **Remove from My List** not treated as negative signal | Low | Removal could subtract the watchlist-addition weight on next rebuild; for now it naturally disappears after the next `buildTaste` call. |
| **Search** not persisted | Medium | Store each search query as a `SEARCH` event in `profile_interaction_events`; consider extracting intent keywords for future keyword-score enrichment. |
| **Item click / detail open** not weighted | Low | Optional: add a 0.1–0.2 weight for `DETAIL_OPENED` events in a future minor signal expansion. |
| **Continue Watching dismiss** not negatively weighted | Medium | After a dismiss, the viewing_progress row (partial watch) continues to contribute +0.5 to taste. Consider adding a "dismissed CW" signal that removes or offsets the partial-watch weight. |

---

## Positive vs negative signal strength ranking

```
LIKE (+3.0) > COMPLETED_VIEW (+1.0) > IN_PROGRESS_VIEW (+0.5) = WATCHLIST (+0.5)
                                                                 > NOT_INTERESTED (−2.0)
                                                                   > DISLIKE (−3.0)

Reranker penalties (applied to final score):
  DISLIKE penalty: −2.0
  NOT_INTERESTED penalty: −1.2
  Abandon (<20% watch): −0.1
  Exposure repetition: −0.05 × min(n, 4) = max −0.2
```

Actions that appear positive in UI but deliberately carry **no taste weight**:
- Shelf impression/exposure → only feeds repetition penalty, not taste
- Play started without meaningful progress → below 5% threshold, ignored
- Search queries → not yet instrumented

---

## Episode → series resolution

All episode-level progress is resolved to the parent series before taste accumulation (`buildTaste` looks up `episodes.seriesId` and calls `accumulateMediaFeatures` on the series). This means:
- Episode completions contribute to the **parent series** genre, keyword, language, decade, and cast scores.
- If the episode lookup fails (orphaned episode), the signal is silently skipped (logged in production).
