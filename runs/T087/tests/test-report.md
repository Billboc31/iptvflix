# T087 — Test report (manual evidence completion)

**Date:** 2026-08-17  
**Verdict:** **PASS (evidence complete)** — previous factory tester correctly BLOCKED; probes now filled.

## Summary

| Area | Result |
|------|--------|
| Golden stream | Spider-Man: No Way Home (`6a0c1ad8-…`) |
| Residential media | **OK** on `.mkv`/`.mp4`; **551** on `.m3u8`/`.ts` |
| Railway upstream | **403 Cloudflare** — `RAILWAY_PROVIDER_BLOCK_CONFIRMED=yes` |
| Browser HTTPS web | **Blocked** by HTTP-only CDN (mixed content) |
| Architecture | **Dedicated HTTPS media relay** (see `adr.md`) |

## Artifacts

- `golden-stream.md`
- `probe-residential.md`
- `probe-railway.md`
- `probe-browsers.md`
- `adr.md`

## Code fixes paired with this evidence

- Do not force `.m3u8` in Xtream resolve.
- Prefer `mp4` container when scoring variants.
