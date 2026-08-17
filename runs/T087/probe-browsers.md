# T087 — Direct Browser Probes

**Status: BLOCKED — requires manual testing in each browser**

Test the raw provider URL directly in each browser — no IPTVFlix player, no app routing.
Open DevTools Network tab before navigating to the URL.

> Use the real URL (with credentials) from `golden-stream.md`. Never commit it.
> URL form: `http(s)://<provider>:<port>/movie/<user>/<pass>/<streamId>.<ext>`

---

## Desktop Chrome

### Steps
1. Open Chrome DevTools (F12) → Network tab → clear, check "Preserve log"
2. Paste the raw provider URL in the address bar and press Enter
3. Record the first request row: Status, Type, Content-Type
4. If video element appears, check Console for media errors
5. Screenshot the Network tab

### Result

| Field | Value |
|-------|-------|
| HTTP status | `[FILL IN]` |
| `Access-Control-Allow-Origin` header present | `YES / NO` |
| CORS error in console | `YES (paste error) / NO` |
| Mixed content blocked (HTTP URL on HTTPS page) | `YES / NO` |
| Content-Type | `[FILL IN]` |
| Video plays in browser tab | `YES / NO` |
| Console media error | `[FILL IN or "none"]` |
| Redirect count | `[FILL IN]` |

**Failure modes identified** (check all that apply):
- [ ] Provider 403 (anti-hotlink / user-agent / IP block)
- [ ] CORS missing `Access-Control-Allow-Origin`
- [ ] Mixed content (HTTP stream on HTTPS page)
- [ ] Container not supported by Chrome (`mp4` / `mkv` / `ts`)
- [ ] Video codec not supported (`h264` / `hevc` / `av1`)
- [ ] Audio codec not supported (`aac` / `ac3` / `eac3`)
- [ ] Redirect to non-browser-accessible URL
- [ ] No bytes received (stream hangs)
- [ ] Other: `[describe]`

**Outcome: `PASS / FAIL`**

---

## Android Chrome

### Steps
- Use remote DevTools (chrome://inspect on desktop connected to Android via USB)
  OR manually note the browser error/state
- Open the raw provider URL in the Android Chrome address bar

### Result

| Field | Value |
|-------|-------|
| HTTP status | `[FILL IN]` |
| `Access-Control-Allow-Origin` header present | `YES / NO` |
| CORS error | `YES (paste error) / NO` |
| Mixed content blocked | `YES / NO` |
| Content-Type | `[FILL IN]` |
| Video plays | `YES / NO` |
| Media error | `[FILL IN or "none"]` |

**Failure modes identified** (check all that apply):
- [ ] Provider 403
- [ ] CORS missing
- [ ] Mixed content
- [ ] Container not supported
- [ ] Video codec not supported
- [ ] Audio codec not supported
- [ ] Other: `[describe]`

**Outcome: `PASS / FAIL`**

---

## iPhone Safari

### Steps
- Open the raw provider URL in Safari on iPhone
- Note what happens: does it try to play, show an error dialog, download the file, or nothing?
- If possible, use Safari Web Inspector (Mac → Safari → Develop → Device → page)

### Result

| Field | Value |
|-------|-------|
| HTTP status (if observable) | `[FILL IN]` |
| Behaviour | `[e.g. "shows QuickTime player", "Error: cannot play", "downloads file"]` |
| CORS error (if inspector available) | `YES / NO` |
| Mixed content blocked | `YES / NO` |
| Media error code | `[FILL IN or "N/A"]` |

**Failure modes identified** (check all that apply):
- [ ] Provider 403
- [ ] CORS missing
- [ ] Mixed content (HTTP URL not allowed on HTTPS origin)
- [ ] Container not supported by Safari (`.mkv` / `.ts`)
- [ ] Video codec not supported (`hevc` without HDR / others)
- [ ] Audio codec not supported (`eac3` without Dolby license)
- [ ] ATS (App Transport Security) blocks HTTP on iOS
- [ ] Redirect handling failure
- [ ] Other: `[describe]`

**Outcome: `PASS / FAIL`**

---

## Summary table

| Browser | HTTP status | CORS | Mixed content | Container | Video codec | Audio codec | Outcome |
|---------|-------------|------|---------------|-----------|-------------|-------------|---------|
| Desktop Chrome | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `PASS/FAIL` |
| Android Chrome | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `PASS/FAIL` |
| iPhone Safari | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `[FILL]` | `PASS/FAIL` |
