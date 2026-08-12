All tests pass. Here's what was done to complete implementation:

**TypeScript fixes in 4 existing test files** — added the 6 new `MetadataProvider` methods (`getMovieVideos`, `getSeriesVideos`, `getMovieCredits`, `getSeriesCredits`, `getMovieCertification`, `getSeriesCertification`) to each `makeProvider()` factory, and added `certification: null` to `ExternalMovieMetadata` fixtures and `certification: null, status: null` to `ExternalSeriesMetadata` fixtures.

**Migration** — the hand-written `0020_media_videos_credits.sql` was missing its `0020_snapshot.json` (needed by drizzle-kit). Applied the SQL directly, then generated the snapshot via `db:generate` (which produced `0021`) and repurposed it as `0020_snapshot.json`, removing the duplicate `0021` files.

**Final results:**
- API: 507/507 tests pass (35 test files)  
- Web: 100/100 tests pass (17 test files)
- Workflow state: `PLAN_APPROVED` → `IMPLEMENTATION_COMPLETE`
