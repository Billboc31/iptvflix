import { MEDIA_RELAY_SECRET, MEDIA_RELAY_URL } from '../config/env.js';
let liveRelayUrl;
let liveRelayAt = 0;
const LIVE_TTL_MS = 30 * 60 * 1000;
export function setLiveMediaRelayUrl(url) {
    liveRelayUrl = url.replace(/\/$/, '');
    liveRelayAt = Date.now();
}
export function getMediaRelayBaseUrl() {
    if (liveRelayUrl && Date.now() - liveRelayAt < LIVE_TTL_MS) {
        return liveRelayUrl;
    }
    return MEDIA_RELAY_URL;
}
export function isMediaRelayEnabled() {
    return Boolean(MEDIA_RELAY_SECRET && getMediaRelayBaseUrl());
}
//# sourceMappingURL=media-relay-runtime.js.map