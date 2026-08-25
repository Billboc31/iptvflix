/**
 * PlayerPage tests.
 *
 * What IS tested here:
 *   - Regression: HLS.js loadSource is called with the correct gateway URL (smoke test for the working playback path).
 *   - Resume dialog is shown when startPositionSeconds > 30 for movies and episodes.
 *   - Resume dialog is NOT shown when startPositionSeconds is 0, below threshold (≤30 s), near end (within 60 s of duration), or when opened with ?source=continue_watching.
 *   - Escape key closes the dialog without starting playback.
 *   - "Reprendre" and "Recommencer" buttons dismiss the dialog.
 *   - Episode dialog heading uses episodeLabel from useEpisodeNavigation.
 *
 * What CANNOT be tested in jsdom:
 *   - Actual HLS video decode / playback (no MSE in jsdom).
 *   - video.currentTime setter (jsdom stub — seek assertions are omitted where applicable).
 *   - iOS Safari webkitEnterFullscreen (no such API in jsdom).
 *   - PiP (not implemented in jsdom).
 *   - sendBeacon / keepalive fetch on beforeunload (synthetic environment).
 *   - Audio/subtitle track switching (requires real HLS.js runtime with MSE).
 *
 * These limitations are documented rather than falsely tested.
 */
export {};
//# sourceMappingURL=PlayerPage.test.d.ts.map