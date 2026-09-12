import { useState, useEffect } from 'react';
import { getSeriesSeasonEpisodes, getEpisodeContext, getSeries } from '../lib/api.js';
const EMPTY = { episodeLabel: null, nextEpisode: null, previousEpisode: null };
export function useEpisodeNavigation(mediaId, seriesId, seasonNumber) {
    const [state, setState] = useState({ key: '', nav: EMPTY });
    const key = `${mediaId}:${seriesId}:${seasonNumber}`;
    useEffect(() => {
        if (!mediaId)
            return;
        let cancelled = false;
        async function load() {
            const context = !seriesId || seasonNumber == null ? await getEpisodeContext(mediaId) : null;
            const sid = seriesId ?? context.seriesId;
            const season = seasonNumber ?? context.seasonNumber;
            const episodes = (await getSeriesSeasonEpisodes(sid, season)).sort((a, b) => a.episodeNumber - b.episodeNumber);
            const idx = episodes.findIndex((e) => e.id === mediaId);
            if (idx < 0)
                return;
            const current = episodes[idx];
            let nextEpisode = episodes[idx + 1] ?? null;
            let nextSeasonNumber = season;
            if (!nextEpisode) {
                const detail = await getSeries(sid).catch(() => null);
                const nextSeason = detail?.seasons.filter((s) => s.seasonNumber === season + 1).sort((a, b) => a.seasonNumber - b.seasonNumber)[0];
                if (nextSeason) {
                    const following = await getSeriesSeasonEpisodes(sid, nextSeason.seasonNumber);
                    nextEpisode = following.sort((a, b) => a.episodeNumber - b.episodeNumber)[0] ?? null;
                    nextSeasonNumber = nextSeason.seasonNumber;
                }
            }
            // Do not silently skip a missing episode in the story.
            if (nextEpisode && (nextEpisode.availabilityStatus === 'UNAVAILABLE' || (nextSeasonNumber === season ? nextEpisode.episodeNumber !== current.episodeNumber + 1 : nextEpisode.episodeNumber !== 1)))
                nextEpisode = null;
            if (!cancelled)
                setState({ key, nav: {
                        episodeLabel: `S${String(season).padStart(2, '0')}E${String(current.episodeNumber).padStart(2, '0')}${current.title ? ` · ${current.title}` : ''}`,
                        nextEpisode, previousEpisode: episodes[idx - 1] ?? null, nextSeasonNumber, resolvedSeriesId: sid,
                    } });
        }
        load().catch(() => { if (!cancelled)
            setState({ key, nav: EMPTY }); });
        return () => { cancelled = true; };
    }, [mediaId, seriesId, seasonNumber, key]);
    return state.key === key ? state.nav : EMPTY;
}
//# sourceMappingURL=useEpisodeNavigation.js.map