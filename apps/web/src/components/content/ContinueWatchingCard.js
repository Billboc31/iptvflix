import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ContinueWatchingOverflowMenu from './ContinueWatchingOverflowMenu.js';
export default function ContinueWatchingCard({ item, onDismiss, dismissError }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const menuTriggerRef = useRef(null);
    const pct = item.durationSeconds > 0
        ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
        : 0;
    const mediaTypeLower = item.mediaType === 'MOVIE' ? 'movie' : 'episode';
    const playerUrl = `/player/${mediaTypeLower}/${item.mediaId}?source=continue_watching`;
    function handlePlay() {
        navigate(playerUrl);
    }
    function handleDetails() {
        setMenuOpen(false);
        if (item.mediaType === 'MOVIE') {
            navigate(`/movies/${item.mediaId}`, { state: { background: location, scrollY: window.scrollY } });
        }
        else if (item.seriesId) {
            navigate(`/series/${item.seriesId}`, { state: { background: location, scrollY: window.scrollY } });
        }
    }
    async function handleDismiss() {
        setMenuOpen(false);
        try {
            await onDismiss(item.mediaType, item.mediaId);
        }
        catch {
            // error is surfaced via dismissError prop from useContinueWatching hook
        }
    }
    const episodeLabel = item.mediaType === 'EPISODE' && item.seasonNumber != null && item.episodeNumber != null
        ? `S${item.seasonNumber}E${item.episodeNumber}${item.episodeTitle ? ` · ${item.episodeTitle}` : ''}`
        : null;
    return (_jsxs("div", { className: "relative w-full", children: [_jsxs("div", { className: "relative aspect-[2/3] bg-[#1a1a24] rounded-lg overflow-hidden", children: [item.posterUrl ? (_jsx("img", { src: item.posterUrl, alt: item.title, className: "w-full h-full object-cover", loading: "lazy" })) : (_jsxs("div", { className: "w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600", children: [_jsx("span", { className: "text-4xl select-none", children: "\uD83C\uDFAC" }), _jsx("span", { className: "text-xs text-center px-2 line-clamp-2", children: item.title })] })), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" }), _jsx("button", { type: "button", onClick: handlePlay, "aria-label": "Reprendre", className: "absolute inset-0 flex items-center justify-center group/play", children: _jsx("span", { className: "w-12 h-12 rounded-full bg-white/20 flex items-center justify-center group-hover/play:bg-white/35 transition-colors", children: _jsx("svg", { className: "w-6 h-6 text-white translate-x-0.5", fill: "currentColor", viewBox: "0 0 24 24", "aria-hidden": "true", children: _jsx("path", { d: "M8 5v14l11-7z" }) }) }) }), episodeLabel && (_jsx("div", { className: "absolute bottom-1 left-0 right-0 px-2 pointer-events-none", children: _jsx("p", { className: "text-white text-[10px] font-medium line-clamp-1 drop-shadow", children: episodeLabel }) }))] }), _jsxs("div", { className: "mt-1.5 px-0.5", children: [_jsx("p", { className: "text-white text-xs font-medium line-clamp-1", children: item.title }), _jsxs("div", { className: "mt-1 flex items-center gap-1", children: [_jsx("div", { className: "flex-1 h-1 bg-gray-700 rounded-full", "aria-label": `${pct}% visionné`, children: _jsx("div", { className: "h-full bg-[#e50914] rounded-full", style: { width: `${pct}%` }, "data-testid": "progress-bar" }) }), _jsx("button", { type: "button", onClick: (e) => {
                                    e.stopPropagation();
                                    handleDetails();
                                }, "aria-label": "Voir les d\u00E9tails", className: "w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded flex-shrink-0", children: _jsxs("svg", { className: "w-4 h-4", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2, "aria-hidden": "true", children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", d: "M12 8h.01M12 11v5" })] }) }), _jsx("button", { ref: menuTriggerRef, type: "button", onClick: (e) => {
                                    e.stopPropagation();
                                    setMenuOpen((o) => !o);
                                }, "aria-label": "Plus d'options", "aria-haspopup": "menu", "aria-expanded": menuOpen, className: "w-7 h-7 flex items-center justify-center text-gray-400 hover:text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white rounded flex-shrink-0", children: _jsxs("svg", { className: "w-4 h-4", fill: "currentColor", viewBox: "0 0 20 20", "aria-hidden": "true", children: [_jsx("circle", { cx: "10", cy: "4", r: "1.5" }), _jsx("circle", { cx: "10", cy: "10", r: "1.5" }), _jsx("circle", { cx: "10", cy: "16", r: "1.5" })] }) })] }), dismissError && (_jsx("p", { className: "text-red-400 text-[10px] mt-0.5", children: dismissError }))] }), menuOpen && (_jsx(ContinueWatchingOverflowMenu, { onClose: () => {
                    setMenuOpen(false);
                    menuTriggerRef.current?.focus();
                }, onDetails: handleDetails, onDismiss: handleDismiss, triggerRef: menuTriggerRef }))] }));
}
//# sourceMappingURL=ContinueWatchingCard.js.map