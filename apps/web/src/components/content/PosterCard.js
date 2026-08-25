import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import Badge from '../ui/Badge.js';
import FocusedCardPortal from './FocusedCardPortal.js';
import { usePreview } from '../../contexts/PreviewContext.js';
const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
export default function PosterCard({ title, year, posterUrl, quality, badge, mediaId, trailerKey, onClick, }) {
    const { activate, deactivate } = usePreview();
    const cardRef = useRef(null);
    const focusTimerRef = useRef(null);
    const previewTimerRef = useRef(null);
    const hoverEpoch = useRef(0);
    const cardRectRef = useRef(null);
    const [isFocused, setIsFocused] = useState(false);
    function handleEnter() {
        if (isTouch())
            return;
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect)
            cardRectRef.current = rect;
        const epoch = ++hoverEpoch.current;
        if (focusTimerRef.current)
            clearTimeout(focusTimerRef.current);
        focusTimerRef.current = setTimeout(() => {
            if (hoverEpoch.current !== epoch)
                return;
            setIsFocused(true);
        }, 400);
    }
    function handleLeave() {
        if (focusTimerRef.current) {
            clearTimeout(focusTimerRef.current);
            focusTimerRef.current = null;
        }
        if (previewTimerRef.current) {
            clearTimeout(previewTimerRef.current);
            previewTimerRef.current = null;
        }
        hoverEpoch.current++;
        setIsFocused(false);
        deactivate();
    }
    // Start preview timer only after card is focused
    useEffect(() => {
        if (!isFocused || !mediaId || !trailerKey)
            return;
        const epoch = hoverEpoch.current;
        previewTimerRef.current = setTimeout(() => {
            if (hoverEpoch.current !== epoch)
                return;
            activate(mediaId, trailerKey);
        }, 1500);
        return () => {
            if (previewTimerRef.current) {
                clearTimeout(previewTimerRef.current);
                previewTimerRef.current = null;
            }
        };
    }, [isFocused, mediaId, trailerKey, activate]);
    useEffect(() => {
        return () => {
            if (focusTimerRef.current)
                clearTimeout(focusTimerRef.current);
            if (previewTimerRef.current)
                clearTimeout(previewTimerRef.current);
        };
    }, []);
    return (_jsxs("div", { ref: cardRef, onClick: onClick, onMouseEnter: handleEnter, onMouseLeave: handleLeave, onFocus: handleEnter, onBlur: handleLeave, className: "relative w-full cursor-pointer group", role: onClick ? 'button' : undefined, tabIndex: onClick ? 0 : undefined, onKeyDown: (e) => e.key === 'Enter' && onClick?.(), children: [_jsxs("div", { className: "aspect-[2/3] bg-[#1a1a24] rounded-lg overflow-hidden relative", children: [posterUrl ? (_jsx("img", { src: posterUrl, alt: title, className: "w-full h-full object-cover", loading: "lazy" })) : (_jsxs("div", { className: "w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600", children: [_jsx("span", { className: "text-4xl select-none", children: "\uD83C\uDFAC" }), _jsx("span", { className: "text-xs text-center px-2 line-clamp-2", children: title })] })), quality && (_jsx("div", { className: "absolute top-1.5 right-1.5", children: _jsx(Badge, { variant: "quality", children: quality }) })), badge && (_jsx("div", { className: "absolute bottom-1.5 left-1.5 right-1.5 flex justify-center", children: _jsx(Badge, { variant: badge.variant, children: badge.label }) })), _jsx("div", { className: "absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center", children: _jsx("span", { className: "px-3 py-1 bg-white text-black text-xs font-semibold rounded-full", children: "D\u00E9tails" }) })] }), _jsxs("div", { className: "mt-1.5 px-0.5", children: [_jsx("p", { className: "text-white text-xs font-medium leading-tight line-clamp-1", children: title }), year && _jsx("p", { className: "text-gray-500 text-xs mt-0.5", children: year })] }), isFocused && (_jsx(FocusedCardPortal, { cardRect: cardRectRef.current, title: title, posterUrl: posterUrl, trailerKey: trailerKey, mediaId: mediaId, onDetailsClick: onClick ?? (() => { }) }))] }));
}
//# sourceMappingURL=PosterCard.js.map