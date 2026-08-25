import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import HorizontalRow from './HorizontalRow.js';
import PosterCard from './PosterCard.js';
import { useOpenDetail } from '../../hooks/useOpenDetail.js';
export default function ShelfRow({ shelf }) {
    const openDetail = useOpenDetail();
    if (!shelf.items?.length)
        return null;
    return (_jsx("div", { className: "mt-8", children: _jsx(HorizontalRow, { title: shelf.title, children: shelf.items.map((item) => {
                const hasProgress = item.progressSeconds != null &&
                    item.durationSeconds != null &&
                    item.durationSeconds > 0;
                const pct = hasProgress
                    ? Math.round((item.progressSeconds / item.durationSeconds) * 100)
                    : 0;
                return (_jsxs("div", { className: "relative flex-shrink-0 w-28 md:w-32 lg:w-36 snap-start", children: [_jsx(PosterCard, { title: item.title, posterUrl: item.posterUrl, mediaId: item.mediaId, trailerKey: item.trailerKey, badge: shelf.id === 'sys_rec_upcoming'
                                ? { label: 'Indisponible', variant: 'unavailable' }
                                : undefined, onClick: () => openDetail(item.mediaType === 'MOVIE' ? 'movie' : 'series', item.mediaId) }), hasProgress && (_jsx("div", { className: "absolute bottom-6 left-0 right-0 h-1 bg-gray-700 mx-0.5", "aria-label": `${pct}% visionné`, children: _jsx("div", { className: "h-full bg-[#e50914]", style: { width: `${pct}%` }, "data-testid": "progress-bar" }) }))] }, `${item.mediaType}-${item.mediaId}`));
            }) }) }));
}
//# sourceMappingURL=ShelfRow.js.map