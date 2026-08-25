All changes are correct and clean. Here's a summary of what was fixed:

---

**Blocking fix: history recording wired to play actions**

**Files modified:**

- `apps/live-tv/src/components/channel/LiveRail.tsx` — added `onRecordHistory?: (channelId) => void` prop; passes it to `ChannelCard.onPlay` which calls `recordHistory(ch.id)` then `window.open`
- `apps/live-tv/src/components/channel/ChannelRow.tsx` — added `onRecordHistory?: () => void` prop; calls it inside `handlePlay` after stream URL is obtained
- `apps/live-tv/src/pages/HomePage.tsx` — destructures `recordHistory` from context; passes it as `onRecordHistory` to both `LiveRail` instances ("En direct maintenant" and "Récemment regardées")
- `apps/live-tv/src/pages/AllChannelsPage.tsx` — destructures `recordHistory` from context; passes `() => recordHistory(channel.id)` as `onRecordHistory` to each `ChannelRow`

**Tests added (2 new, total now 31):**
- `LiveRail.test.tsx` — verifies `onRecordHistory` is called with the channel id when a card is played
- `AllChannelsPage.test.tsx` — verifies `recordHistory` from context is called with the channel id when a play button is clicked
