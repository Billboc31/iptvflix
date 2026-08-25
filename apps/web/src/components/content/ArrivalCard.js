import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { markArrivalRead } from '../../lib/api.js';
import { useOpenDetail } from '../../hooks/useOpenDetail.js';
function relativeTime(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60)
        return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24)
        return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days} j`;
}
export default function ArrivalCard({ arrival, onDismiss }) {
    const openDetail = useOpenDetail();
    function handleClick() {
        openDetail(arrival.mediaType === 'MOVIE' ? 'movie' : 'series', arrival.mediaId);
    }
    async function handleDismiss(e) {
        e.stopPropagation();
        await markArrivalRead(arrival.id).catch(() => { });
        onDismiss?.(arrival.id);
    }
    return (_jsxs("div", { onClick: handleClick, className: "relative flex-shrink-0 w-44 cursor-pointer group", role: "button", tabIndex: 0, onKeyDown: (e) => e.key === 'Enter' && handleClick(), children: [_jsxs("div", { className: "aspect-[2/3] bg-[#1a1a24] rounded-lg overflow-hidden relative flex flex-col items-center justify-center gap-1 text-gray-500", children: [_jsx("span", { className: "text-3xl select-none", children: arrival.mediaType === 'MOVIE' ? '🎬' : '📺' }), _jsx("span", { className: "text-xs text-center px-2 line-clamp-2 text-white font-medium", children: arrival.mediaTitle }), _jsx("div", { className: "absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center", children: _jsx("span", { className: "px-3 py-1 bg-white text-black text-xs font-semibold rounded-full", children: "Voir" }) }), onDismiss && (_jsx("button", { onClick: handleDismiss, className: "absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 text-gray-400 hover:text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", "aria-label": "Marquer comme lu", title: "Marquer comme lu", children: "\u00D7" }))] }), _jsxs("div", { className: "mt-1.5 px-0.5", children: [_jsx("p", { className: "text-white text-xs font-medium leading-tight line-clamp-1", children: arrival.mediaTitle }), arrival.sourceName && (_jsx("p", { className: "text-gray-500 text-xs mt-0.5 line-clamp-1", children: arrival.sourceName })), _jsx("p", { className: "text-gray-600 text-xs mt-0.5", children: relativeTime(arrival.arrivedAt) })] })] }));
}
//# sourceMappingURL=ArrivalCard.js.map