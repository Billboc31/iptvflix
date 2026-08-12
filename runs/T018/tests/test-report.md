Test report written. Here's the summary:

---

## Validation Result: **PASS** — all 8 acceptance criteria satisfied

**Tests executed:** 401 total (337 API + 64 web), 0 failures.

| AC | Description | Result |
|----|-------------|--------|
| AC1 | French UI + English audio + French subtitles (locale independence) | ✅ PASS |
| AC2 | Ordered audio-language preferences and source priority | ✅ PASS |
| AC3 | Backend deterministically selects one best variant | ✅ PASS |
| AC4 | Quality does not override language/source priority | ✅ PASS |
| AC5 | Alternative variants remain accessible to user | ✅ PASS |
| AC6 | Unknown/null metadata has deterministic fallback | ✅ PASS |
| AC7 | Unavailable variants cannot be selected | ✅ PASS |
| AC8 | Automated tests cover all required cases | ✅ PASS |

**Notable verifications:**
- `resolveVariant()` uses a stable 5-tuple sort `[audio, subtitle, source, quality, id]` — quality is deliberately ranked below audio/source.
- The `ProfileSettingsPage.test.tsx` directly tests that `navigator.language='de'` does not pollute playback preferences (`['en', 'fr']`), proving locale independence.
- A pre-existing typecheck issue (5 errors in `sources.test.ts`/`catalog-sync-service.test.ts`) predates T018 and is not a regression.
