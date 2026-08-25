import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { getSeriesSeasonEpisodes } from '../../lib/api.js';
import Spinner from '../ui/Spinner.js';
import EpisodeCard from './EpisodeCard.js';
export default function SeasonSelector({ seriesId, seasons, profileId, devices, progressByEpisodeId }) {
    const [selectedSeason, setSelectedSeason] = useState(seasons.length > 0 ? seasons[0].seasonNumber : 0);
    const [episodeCache, setEpisodeCache] = useState(new Map());
    const [loading, setLoading] = useState(false);
    const [refreshToken, setRefreshToken] = useState(0);
    const episodeCacheRef = useRef(episodeCache);
    episodeCacheRef.current = episodeCache;
    useEffect(() => {
        function onVisible() {
            if (document.visibilityState !== 'visible')
                return;
            const cached = episodeCacheRef.current.get(selectedSeason);
            const allUnavailable = cached != null && cached.length > 0 && cached.every((ep) => ep.availabilityCount === 0);
            if (allUnavailable)
                setRefreshToken((t) => t + 1);
        }
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [selectedSeason]);
    useEffect(() => {
        if (seasons.length === 0)
            return;
        let cancelled = false;
        const cached = episodeCacheRef.current.get(selectedSeason);
        const stale = cached != null &&
            cached.length > 0 &&
            cached.every((ep) => ep.availabilityCount === 0);
        if (cached != null && cached.length > 0 && !stale) {
            setLoading(false);
            return;
        }
        setLoading(true);
        async function loadEpisodes() {
            for (let i = 0; i < 10; i++) {
                try {
                    const eps = await getSeriesSeasonEpisodes(seriesId, selectedSeason, profileId);
                    if (cancelled)
                        return;
                    setEpisodeCache((prev) => new Map([...prev, [selectedSeason, eps]]));
                    setLoading(false);
                    return;
                }
                catch {
                    /* retry while TMDB hydration is still running */
                }
                await new Promise((r) => setTimeout(r, 2000));
                if (cancelled)
                    return;
            }
            if (!cancelled) {
                setEpisodeCache((prev) => new Map([...prev, [selectedSeason, []]]));
                setLoading(false);
            }
        }
        void loadEpisodes();
        return () => {
            cancelled = true;
        };
    }, [seriesId, selectedSeason, profileId, seasons.length, refreshToken]);
    useEffect(() => {
        if (seasons.length === 0)
            return;
        if (!seasons.some((s) => s.seasonNumber === selectedSeason)) {
            setSelectedSeason(seasons[0].seasonNumber);
        }
    }, [seasons, selectedSeason]);
    if (seasons.length === 0) {
        return _jsx("p", { className: "text-gray-400 text-sm", children: "Chargement des saisons\u2026" });
    }
    const episodes = episodeCache.get(selectedSeason);
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-4", children: [_jsx("label", { htmlFor: "season-select", className: "sr-only", children: "Saison" }), _jsx("select", { id: "season-select", value: selectedSeason, onChange: (e) => setSelectedSeason(Number(e.target.value)), className: "bg-[#1a1a24] border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e50914] cursor-pointer", children: seasons.map((s) => (_jsxs("option", { value: s.seasonNumber, children: [s.title ?? `Saison ${s.seasonNumber}`, s.airYear ? ` (${s.airYear})` : ''] }, s.seasonNumber))) })] }), loading ? (_jsx("div", { className: "flex justify-center py-8", children: _jsx(Spinner, {}) })) : episodes && episodes.length > 0 ? (_jsx("div", { className: "flex flex-col gap-2", children: episodes.map((ep) => (_jsx(EpisodeCard, { episode: ep, devices: devices, progressMs: progressByEpisodeId?.[ep.id] ?? 0, seriesId: seriesId, seasonNumber: selectedSeason }, ep.id))) })) : (_jsx("p", { className: "text-gray-500 text-sm py-4", children: "Aucun \u00E9pisode disponible." }))] }));
}
//# sourceMappingURL=SeasonSelector.js.map