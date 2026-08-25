import { useState, useEffect } from 'react';
import { getSeriesSeasonEpisodes } from '../lib/api.js';
export function useEpisodeNavigation(mediaId, seriesId, seasonNumber) {
    const [episodes, setEpisodes] = useState([]);
    useEffect(() => {
        if (!seriesId || seasonNumber === null)
            return;
        let cancelled = false;
        getSeriesSeasonEpisodes(seriesId, seasonNumber)
            .then((eps) => {
            if (!cancelled)
                setEpisodes(eps);
        })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [seriesId, seasonNumber]);
    if (!mediaId || episodes.length === 0) {
        return { episodeLabel: null, nextEpisode: null, previousEpisode: null };
    }
    const idx = episodes.findIndex((e) => e.id === mediaId);
    if (idx === -1) {
        return { episodeLabel: null, nextEpisode: null, previousEpisode: null };
    }
    const current = episodes[idx];
    const sLabel = seasonNumber != null ? `S${String(seasonNumber).padStart(2, '0')}` : '';
    const eLabel = `E${String(current.episodeNumber).padStart(2, '0')}`;
    const episodeLabel = `${sLabel}${eLabel}${current.title ? ` · ${current.title}` : ''}`;
    const nextEpisode = idx < episodes.length - 1 ? (episodes[idx + 1] ?? null) : null;
    const previousEpisode = idx > 0 ? (episodes[idx - 1] ?? null) : null;
    return { episodeLabel, nextEpisode, previousEpisode };
}
//# sourceMappingURL=useEpisodeNavigation.js.map