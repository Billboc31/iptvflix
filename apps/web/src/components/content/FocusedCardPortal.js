import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import PreviewPlayer from './PreviewPlayer.js';
import { usePreview } from '../../contexts/PreviewContext.js';
export default function FocusedCardPortal({ cardRect, title, posterUrl, trailerKey, mediaId, onDetailsClick, }) {
    const { activeId } = usePreview();
    const [visible, setVisible] = useState(false);
    const isActive = !!mediaId && activeId === mediaId;
    useEffect(() => {
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
    }, []);
    const rectWidth = cardRect?.width ?? 0;
    const rectHeight = cardRect?.height ?? 0;
    const rectLeft = cardRect?.left ?? 0;
    const rectRight = cardRect?.right ?? 0;
    const rectTop = cardRect?.top ?? 0;
    const portalWidth = Math.round(rectWidth * 1.75);
    const portalHeight = Math.round(portalWidth * 1.5);
    const cardMidX = rectLeft + rectWidth / 2;
    const cardMidY = rectTop + rectHeight / 2;
    // Horizontal: left-edge / right-edge / centered
    let left;
    if (rectLeft < 160) {
        left = rectLeft;
    }
    else if (rectRight > window.innerWidth - 160) {
        left = rectRight - portalWidth;
    }
    else {
        left = cardMidX - portalWidth / 2;
    }
    left = Math.max(8, Math.min(left, window.innerWidth - portalWidth - 8));
    // Vertical: center on card midpoint, clamped to viewport
    let top = cardMidY - portalHeight / 2;
    top = Math.max(8, Math.min(top, window.innerHeight - portalHeight - 8));
    return createPortal(_jsxs("div", { "data-testid": "focused-card-portal", "aria-hidden": "true", style: {
            position: 'fixed',
            left,
            top,
            width: portalWidth,
            height: portalHeight,
            zIndex: 35,
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1)' : 'scale(0.95)',
            transition: 'opacity 200ms ease, transform 200ms ease',
            transformOrigin: 'center',
        }, className: "rounded-xl overflow-hidden shadow-2xl bg-[#1a1a24]", children: [posterUrl && (_jsx("img", { src: posterUrl, alt: "", "aria-hidden": "true", className: "absolute inset-0 w-full h-full object-cover" })), trailerKey && _jsx(PreviewPlayer, { trailerKey: trailerKey, active: isActive }), _jsx("div", { className: "absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/90 to-transparent" }), _jsxs("div", { className: "absolute inset-x-0 bottom-0 p-3 flex flex-col gap-2", children: [_jsx("p", { className: "text-white text-sm font-semibold line-clamp-2 leading-tight drop-shadow", children: title }), _jsx("button", { onClick: onDetailsClick, className: "w-full px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-full backdrop-blur-sm transition-colors", tabIndex: -1, children: "D\u00E9tails" })] })] }), document.body);
}
//# sourceMappingURL=FocusedCardPortal.js.map