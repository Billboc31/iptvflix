# Phase 8 — Cross-Device Validation

**Status: BLOCKED / AWAITING REAL DEVICE VALIDATION**

## Devices to validate

### Desktop Chrome/Chromium
- [ ] Navigate to IPTVFlix, click `Regarder` for the golden-path movie
- [ ] Video plays with moving image and audio
- [ ] No console errors
- Capture: Network trace screenshot + video playing screenshot

### Android Chrome
- [ ] Same movie on Android Chrome
- [ ] Video plays or capture exact MediaError code
- Capture: Screenshot or error details

### iPhone Safari
- [ ] Same movie on iPhone Safari
- [ ] Video plays or capture exact HLS/MediaError
- Note: Safari requires strict HLS compliance — manifest must have correct MIME, segments must be MPEG-TS
- Capture: Screenshot or error details

## Xtream HLS compatibility notes

The current delivery strategy (redirect to provider HLS URL) means:
- **Desktop Chrome:** hls.js handles M3U8 → should work if provider serves valid HLS
- **Android Chrome:** hls.js → should work same as desktop
- **iPhone Safari:** Native HLS → requires `Content-Type: application/vnd.apple.mpegurl` and valid MPEG-TS segments

If iPhone Safari fails:
1. Capture the exact network request that fails (manifest or segment)
2. Note the HTTP status and Content-Type
3. Note any `MediaError` code on the `<video>` element
4. Common issues: wrong MIME type, non-standard M3U8, HEVC codec in segments

## Evidence required
- Desktop Chrome: working video screenshot
- Android Chrome: working video screenshot OR `{ errorCategory, correlationId }` from API
- iPhone Safari: working video screenshot OR exact device error with HTTP evidence
