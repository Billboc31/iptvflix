## Objective

Extend the `profiles` table with explicit playback preferences (audio/subtitle languages, source priority, quality cap) and implement a backend-only deterministic availability resolver that selects the best playable variant per profile, returning `selectedVariantId` plus alternatives in all media detail responses. Add a web settings page to configure these preferences, proving UI locale and playback language are independent.

## Included

### 1. Extend `profiles` schema

**`apps/api/src/db/schema/profiles.ts`** — add four columns:
- `preferredAudioLanguages: text('preferred_audio_languages').array().notNull().default(sql\`'{}'\`)` — ordered list of BCP-47 language codes (e.g. `["en", "fr"]`)
- `preferredSubtitleLanguages: text('preferred_subtitle_languages').array().notNull().default(sql\`'{}'\`)` — same structure
- `preferredSourceIds: text('preferred_source_ids').array().notNull().default(sql\`'{}'\`)` — ordered list of `providerId` values
- `maxVideoQuality: text('max_video_quality')` — nullable ceiling: `'4K' | '1080p' | '720p' | '480p' | null`

Generate and apply a Drizzle migration (via `drizzle-kit generate` + `drizzle-kit migrate`).

---

### 2. Extend API contracts

**`packages/api-contracts/src/catalog.ts`**:
- Add `status: 'AVAILABLE' | 'UNAVAILABLE'` and `providerId: string` to `AvailabilityVariantResponse`
- Add `selectedVariantId: string | null` to `MovieDetailResponse`, `SeriesDetailResponse`, `EpisodeResponse`

**`packages/api-contracts/src/profile.ts`** (new file):
```ts
export type ProfilePreferences = {
  preferredAudioLanguages: string[]
  preferredSubtitleLanguages: string[]
  preferredSourceIds: string[]
  maxVideoQuality: string | null
}
export type UpdateProfilePreferencesBody = Partial<ProfilePreferences>
export type ProfileResponse = {
  id: string
  name: string
  preferences: ProfilePreferences
}
```

**`packages/api-contracts/src/index.ts`** — add `export * from './profile.js'`

---

### 3. New `availability-resolver.ts` service

**`apps/api/src/services/availability-resolver.ts`** (new file):

Types accepted by the resolver:
```ts
type ResolvableVariant = {
  id: string
  status: 'AVAILABLE' | 'UNAVAILABLE'
  providerId: string
  audioLanguage: string | null
  subtitleLanguage: string | null
  videoQuality: string | null
}
type ResolveResult = {
  selectedVariantId: string | null
  alternativeVariantIds: string[]
  reason: string
}
```

`resolveVariant(variants: ResolvableVariant[], prefs: ProfilePreferences): ResolveResult`:

1. Filter to `status === 'AVAILABLE'` candidates. If none → `{ selectedVariantId: null, alternativeVariantIds: [], reason: 'no_available_variant' }`.
2. Score each candidate with a 5-tuple (lexicographic ascending = better rank):
   - **audioScore**: `prefs.preferredAudioLanguages.indexOf(lang)` if found (0 = best), else `prefs.preferredAudioLanguages.length`. `null` audio treated as not-found (fallback, not excluded).
   - **subtitleScore**: same logic with `preferredSubtitleLanguages`.
   - **sourceScore**: `prefs.preferredSourceIds.indexOf(providerId)` if found, else `prefs.preferredSourceIds.length`.
   - **qualityScore**: `-qualityRank(quality, prefs.maxVideoQuality)` where `qualityRank` returns `QUALITY_ORDER[quality] ?? -1`, capped at the rank of `maxVideoQuality` if set (variant quality exceeding the cap is scored as if at-cap rather than excluded).
   - **tieBreak**: `variant.id` ascending (UUID lexicographic).
3. Sort candidates by the 5-tuple. First candidate → `selectedVariantId`. Remainder → `alternativeVariantIds`.
4. `reason` field encodes the winning dimension (e.g. `'audio_match[0]'`, `'fallback_quality'`, `'tie_break'`).

Empty `prefs` arrays → all scores equal → selection is purely quality-then-id deterministic.

---

### 4. New profile route

**`apps/api/src/routes/profile.ts`** (new file):
- `GET /profile` → load default profile from DB, return `ProfileResponse`
- `PATCH /profile/preferences` → validate body as `UpdateProfilePreferencesBody`, merge into DB record, return updated `ProfileResponse`

**`apps/api/src/index.ts`** — import and register `profileRoutes`.

---

### 5. Extend catalog detail routes with resolver

**`apps/api/src/routes/catalog.ts`** — modify `GET /movies/:id`, `GET /series/:id`, and `GET /series/:id/seasons/:seasonNumber/episodes`:

- In each variant DB query, additionally select `providerId` and `status`.
- After fetching variants, call `resolveVariant(variants, profilePreferences)`.
- Include `providerId` and `status` in each `AvailabilityVariantResponse`.
- Include `selectedVariantId` in the detail response.
- Load profile preferences once at the top of each handler (single DB read via `getDefaultProfile()`).
- Remove the local `bestQuality()` / `QUALITY_ORDER` duplicates from `catalog.ts` and `catalog-service.ts`; quality ranking now lives exclusively in the resolver.

Hypothesis: `catalog.ts` is not yet registered in `index.ts`. If so, register `catalogRoutes` there and remove the overlapping `moviesRoutes` / `seriesRoutes` registrations to avoid duplicate route conflicts. If `movies.ts` / `series.ts` are canonical, extend those instead.

---

### 6. Frontend — Profile settings page

**`apps/web/src/lib/api.ts`** — add:
- `getProfile(): Promise<ProfileResponse>`
- `updateProfilePreferences(body: UpdateProfilePreferencesBody): Promise<ProfileResponse>`

**`apps/web/src/pages/ProfileSettingsPage.tsx`** (new file):
- Fetch current preferences on mount.
- Render independently of browser/UI locale:
  - Ordered input for preferred audio languages (add/remove/reorder, e.g. `["en", "fr"]`)
  - Same for subtitle languages
  - Optional source priority list (if sources are configured)
  - Quality cap dropdown (`null`, `'480p'`, `'720p'`, `'1080p'`, `'4K'`)
- Submit via `PATCH /profile/preferences`.

Add route in the React Router config (e.g. `/settings/playback`).

**`apps/web/src/pages/MovieDetailPage.tsx`** and **`apps/web/src/pages/SeriesDetailPage.tsx`**:
- Display the selected variant's metadata (audioLanguage, subtitleLanguage, videoQuality) as the default choice.
- When `variants.length > 1` and multiple AVAILABLE variants exist, render a compact variant selector listing alternatives.

---

### 7. Tests

**`apps/api/src/services/__tests__/availability-resolver.test.ts`** (new, unit tests — no DB required):
- Audio language preference: profile `["en"]`, variant with `audioLanguage:"en"` wins over `audioLanguage:"fr"`.
- Ordered audio preference: `["fr","en"]` → fr variant wins; `["en","fr"]` → en variant wins.
- Subtitle language match as tiebreaker.
- Source priority overrides quality: preferred-source 720p beats non-preferred 1080p (equal audio score).
- Quality ranking within cap: `maxVideoQuality:"1080p"` → 4K variant scored at 1080p rank, beaten by an actual 1080p on tiebreak but not excluded.
- Unknown/null audio: null-audio variant appears in `alternativeVariantIds`, never silently dropped.
- No-availability: all variants `UNAVAILABLE` → `selectedVariantId: null`, empty alternatives.
- Tie-break determinism: two identical-score variants → lower UUID wins consistently.
- Unavailable variants: `status:'UNAVAILABLE'` variant cannot become `selectedVariantId`.

Update **`apps/api/src/routes/catalog.test.ts`** (or `movies.test.ts`): assert that `GET /movies/:id` response includes `selectedVariantId` and that each variant has `status` and `providerId`.

**`apps/web/src/pages/ProfileSettingsPage.test.tsx`** (new):
- MSW handler returns profile with `preferredAudioLanguages:["en"]`, `preferredSubtitleLanguages:["fr"]`.
- Page renders the language fields with those values regardless of `navigator.language` mock.
- Submitting an update triggers `PATCH /profile/preferences` with correct body.

## Excluded

- Actual video playback or player integration of any kind.
- Automatic bandwidth measurement or adaptive bitrate streaming.
- Per-device preference synchronization beyond the single default profile.
- Multi-profile UI / profile switching (DEFAULT_PROFILE_ID remains hardcoded).
- Deriving playback language defaults from browser locale or UI locale.
- Renaming or refactoring `catalog-service.ts` beyond removing the duplicated `bestQuality` helper.

## Acceptance criteria

1. `GET /profile` returns `{ preferences: { preferredAudioLanguages, preferredSubtitleLanguages, preferredSourceIds, maxVideoQuality } }` with no relation to the current browser locale.
2. `PATCH /profile/preferences` with `{ preferredAudioLanguages: ["en"], preferredSubtitleLanguages: ["fr"] }` persists and round-trips correctly.
3. `GET /movies/:id` response includes `selectedVariantId` (a valid availability id or `null`) and each variant object contains `status` and `providerId`.
4. Profile preferring `audioLanguage:"en"` → `selectedVariantId` points to the en-audio variant when both en and fr variants are AVAILABLE.
5. Source priority tiebreaker: preferred-source 720p outranks non-preferred-source 1080p when audio scores are equal.
6. A variant with `status:"UNAVAILABLE"` is never returned as `selectedVariantId`.
7. A variant with `audioLanguage:null` appears in `alternativeVariantIds`, not silently dropped.
8. `resolveVariant()` unit tests cover all eight cases listed in §7.
9. Profile settings page renders language preference inputs without reading `navigator.language`.
10. `pnpm test` (full suite) passes with no regressions.
