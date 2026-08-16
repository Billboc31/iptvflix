import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useWatchlist } from '../../hooks/useWatchlist.js';
export default function WatchlistButton({ mediaType, mediaId }) {
    const { entries, add, remove } = useWatchlist();
    const isInList = entries.some((e) => e.mediaType === mediaType && e.mediaId === mediaId);
    const handleClick = () => {
        if (isInList) {
            remove(mediaType, mediaId);
        }
        else {
            add(mediaType, mediaId);
        }
    };
    return (_jsxs("button", { onClick: handleClick, "aria-label": isInList ? 'Retirer de Ma liste' : 'Ajouter à Ma liste', title: isInList ? 'Retirer de Ma liste' : 'Ajouter à Ma liste', className: "flex items-center gap-2 px-4 py-2 rounded border border-white/40 text-white text-sm font-medium hover:bg-white/10 transition-colors", children: [_jsx("span", { className: "text-lg leading-none", children: isInList ? '✓' : '+' }), _jsx("span", { children: "Ma liste" })] }));
}
//# sourceMappingURL=WatchlistButton.js.map