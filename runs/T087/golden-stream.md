# T087 — Golden Stream Selection

**Status: BLOCKED — requires running find-golden-stream.ts against the production DATABASE_URL**

## How to run

From the `apps/api/` directory, with the Railway production DATABASE_URL:

```bash
DATABASE_URL="<railway-postgres-url>" npx tsx scripts/find-golden-stream.ts
```

The script outputs sanitized metadata (no credentials) for the 5 most-recently-seen AVAILABLE Xtream movie availabilities with a non-null `container_extension`.

## Selected golden stream

> Fill in after running the script. Never write real credentials here.

| Field | Value |
|-------|-------|
| Movie title | `[FILL IN]` |
| Movie ID | `[FILL IN]` |
| Availability ID | `[FILL IN]` |
| Source ID | `[FILL IN]` |
| Source name | `[FILL IN]` |
| Xtream stream ID | `[FILL IN]` |
| Container extension | `[FILL IN]` |
| Video quality | `[FILL IN]` |
| Audio language | `[FILL IN]` |

## URL shape (credentials redacted)

```
[FILL IN e.g. http://provider.example:8080/movie/[REDACTED]/[REDACTED]/12345.mkv]
```

## URL construction verification

`buildXtreamMovieUrl()` in `apps/api/src/providers/xtream/playback.ts:4` generates:

```
{base_url}/movie/{username}/{password}/{xtream_stream_id}.{container_extension}
```

The script verifies the output matches the pattern `/movie/[REDACTED]/[REDACTED]/{id}.{ext}`.

Expected result from script: `URL shape valid: YES (/movie/{user}/{pass}/{id}.{ext})`

## Provider API confirmation

Confirm the URL shape against the provider API by running from a residential network:

```bash
# Replace <real-url> with the actual URL (never commit it)
curl -v -L --max-time 10 "<real-url>" -o /dev/null 2>&1 | grep -E "^[<>*]"
```

Expected: HTTP 200 or 206, `Content-Type: video/*` or `application/octet-stream`.
If 403 from residential: provider auth/URL is broken — stop and fix before continuing.
