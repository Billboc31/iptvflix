import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useWatchlist } from '../hooks/useWatchlist.js';
import EmptyState from '../components/ui/EmptyState.js';
import PosterCard from '../components/content/PosterCard.js';
import { useOpenDetail } from '../hooks/useOpenDetail.js';
export default function MyListPage() {
    const { entries, loading, remove } = useWatchlist();
    const openDetail = useOpenDetail();
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center py-20", children: _jsx("div", { className: "text-gray-400", children: "Chargement\u2026" }) }));
    }
    if (entries.length === 0) {
        return (_jsx(EmptyState, { icon: "\u2661", heading: "Votre liste est vide", description: "Ajoutez des films et s\u00E9ries \u00E0 regarder plus tard." }));
    }
    return (_jsxs("div", { className: "px-8 py-8", children: [_jsx("h1", { className: "text-2xl font-semibold text-white mb-6", children: "Ma liste" }), _jsx("div", { className: "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4", children: entries.map((entry) => (_jsxs("div", { className: "relative group", children: [_jsx(PosterCard, { title: entry.title, posterUrl: entry.posterUrl, onClick: () => openDetail(entry.mediaType === 'MOVIE' ? 'movie' : 'series', entry.mediaId) }), _jsx("button", { onClick: () => remove(entry.mediaType, entry.mediaId), "aria-label": "Retirer de Ma liste", className: "absolute top-1 left-1 z-10 w-6 h-6 rounded-full bg-black/70 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center", children: "\u2715" })] }, entry.id))) })] }));
}
//# sourceMappingURL=MyListPage.js.map