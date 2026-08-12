import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { getSeriesSeasonEpisodes } from '../../lib/api.js';
import Spinner from '../ui/Spinner.js';
import EpisodeRow from './EpisodeRow.js';
export default function SeasonAccordion({ seriesId, seasons, profileId }) {
    const [expanded, setExpanded] = useState(new Set());
    const [episodeCache, setEpisodeCache] = useState(new Map());
    const [loading, setLoading] = useState(new Set());
    if (seasons.length === 0) {
        return (_jsx("p", { className: "text-gray-400 text-sm", children: "Les saisons ne sont pas encore disponibles." }));
    }
    async function toggle(seasonNumber) {
        const nextExpanded = new Set(expanded);
        if (nextExpanded.has(seasonNumber)) {
            nextExpanded.delete(seasonNumber);
            setExpanded(nextExpanded);
            return;
        }
        nextExpanded.add(seasonNumber);
        setExpanded(nextExpanded);
        if (episodeCache.has(seasonNumber))
            return;
        setLoading((prev) => new Set([...prev, seasonNumber]));
        try {
            const eps = await getSeriesSeasonEpisodes(seriesId, seasonNumber, profileId);
            setEpisodeCache((prev) => new Map([...prev, [seasonNumber, eps]]));
        }
        finally {
            setLoading((prev) => {
                const next = new Set(prev);
                next.delete(seasonNumber);
                return next;
            });
        }
    }
    return (_jsx("div", { className: "flex flex-col gap-2", children: seasons.map((season) => {
            const isExpanded = expanded.has(season.seasonNumber);
            const isLoading = loading.has(season.seasonNumber);
            const eps = episodeCache.get(season.seasonNumber);
            return (_jsxs("div", { className: "bg-[#1a1a24] border border-white/5 rounded-lg overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggle(season.seasonNumber), className: "w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors", "aria-expanded": isExpanded, children: [_jsxs("span", { className: "text-gray-200 text-sm font-medium", children: ["Saison ", season.seasonNumber, season.title ? ` — ${season.title}` : ''] }), _jsxs("span", { className: "flex items-center gap-3 text-gray-500 text-xs flex-shrink-0 ml-4", children: [season.episodeCount > 0 && (_jsxs("span", { children: [season.availableEpisodeCount, " / ", season.episodeCount, " disponible", season.availableEpisodeCount > 1 ? 's' : ''] })), season.airYear && _jsx("span", { children: season.airYear }), _jsx("span", { className: "text-gray-400", children: isExpanded ? '▲' : '▼' })] })] }), isExpanded && (_jsx("div", { className: "border-t border-white/5 px-4", children: isLoading ? (_jsx("div", { className: "py-4 flex justify-center", children: _jsx(Spinner, {}) })) : eps && eps.length > 0 ? (eps.map((ep) => _jsx(EpisodeRow, { episode: ep }, ep.id))) : (_jsx("p", { className: "py-4 text-gray-500 text-sm", children: "Aucun \u00E9pisode disponible." })) }))] }, season.seasonNumber));
        }) }));
}
//# sourceMappingURL=SeasonAccordion.js.map