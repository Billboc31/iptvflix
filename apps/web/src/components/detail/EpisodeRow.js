import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Badge from '../ui/Badge.js';
export default function EpisodeRow({ episode }) {
    const durationLabel = episode.durationMinutes ? `${episode.durationMinutes} min` : null;
    const airLabel = episode.airDate
        ? new Date(episode.airDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' })
        : null;
    const isUnavailable = episode.availabilityStatus === 'UNAVAILABLE';
    return (_jsxs("div", { className: `flex gap-3 py-3 border-b border-white/5 last:border-0 ${isUnavailable ? 'opacity-50' : ''}`, children: [_jsx("span", { className: "flex-shrink-0 w-8 text-right text-gray-500 text-sm pt-0.5", children: episode.episodeNumber }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 mb-1", children: [_jsx("span", { className: "text-gray-200 text-sm font-medium", children: episode.title ?? `Épisode ${episode.episodeNumber}` }), _jsx(Badge, { variant: isUnavailable ? 'unavailable' : 'available', children: isUnavailable ? 'Indisponible' : 'Disponible' }), episode.watchState === 'watched' && (_jsx("span", { "aria-label": "Vu", className: "text-green-400 text-xs font-medium", children: "\u2713 Vu" })), episode.watchState === 'in_progress' && (_jsx("span", { "aria-label": "En cours", className: "text-blue-400 text-xs font-medium", children: "\u25D1 En cours" }))] }), episode.synopsis && (_jsx("p", { className: "text-gray-400 text-xs leading-relaxed line-clamp-2 mb-1", children: episode.synopsis })), _jsxs("div", { className: "flex flex-wrap gap-3 text-gray-500 text-xs", children: [durationLabel && _jsx("span", { children: durationLabel }), airLabel && _jsx("span", { children: airLabel })] })] })] }));
}
//# sourceMappingURL=EpisodeRow.js.map