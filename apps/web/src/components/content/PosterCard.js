import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import Badge from '../ui/Badge.js';
import PreviewPlayer from './PreviewPlayer.js';
import { usePreview } from '../../contexts/PreviewContext.js';
const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
export default function PosterCard({ title, year, posterUrl, quality, badge, mediaId, trailerKey, onClick, }) {
    const { activeId, activate, deactivate } = usePreview();
    const timerRef = useRef(null);
    const isActive = !!mediaId && activeId === mediaId;
    function startPreview() {
        if (!mediaId || !trailerKey || isTouch())
            return;
        timerRef.current = setTimeout(() => activate(mediaId, trailerKey), 1500);
    }
    function cancelPreview() {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
        if (isActive)
            deactivate();
    }
    useEffect(() => {
        return () => {
            if (timerRef.current)
                clearTimeout(timerRef.current);
        };
    }, []);
    return (_jsxs("div", { onClick: onClick, onMouseEnter: startPreview, onMouseLeave: cancelPreview, onFocus: startPreview, onBlur: cancelPreview, className: "relative w-full cursor-pointer group", role: onClick ? 'button' : undefined, tabIndex: onClick ? 0 : undefined, onKeyDown: (e) => e.key === 'Enter' && onClick?.(), children: [_jsxs("div", { className: "aspect-[2/3] bg-[#1a1a24] rounded-lg overflow-hidden relative", children: [posterUrl ? (_jsx("img", { src: posterUrl, alt: title, className: "w-full h-full object-cover", loading: "lazy" })) : (_jsxs("div", { className: "w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600", children: [_jsx("span", { className: "text-4xl select-none", children: "\uD83C\uDFAC" }), _jsx("span", { className: "text-xs text-center px-2 line-clamp-2", children: title })] })), trailerKey && _jsx(PreviewPlayer, { trailerKey: trailerKey, active: isActive }), quality && (_jsx("div", { className: "absolute top-1.5 right-1.5", children: _jsx(Badge, { variant: "quality", children: quality }) })), badge && (_jsx("div", { className: "absolute bottom-1.5 left-1.5 right-1.5 flex justify-center", children: _jsx(Badge, { variant: badge.variant, children: badge.label }) })), _jsx("div", { className: "absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center", children: _jsx("span", { className: "px-3 py-1 bg-white text-black text-xs font-semibold rounded-full", children: "D\u00E9tails" }) })] }), _jsxs("div", { className: "mt-1.5 px-0.5", children: [_jsx("p", { className: "text-white text-xs font-medium leading-tight line-clamp-1", children: title }), year && _jsx("p", { className: "text-gray-500 text-xs mt-0.5", children: year })] })] }));
}
//# sourceMappingURL=PosterCard.js.map