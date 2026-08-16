import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import Button from '../ui/Button.js';
import PreviewPlayer from './PreviewPlayer.js';
import { usePreview } from '../../contexts/PreviewContext.js';
function isPointerCoarse() {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(pointer: coarse)').matches
        : false;
}
export default function HeroSection({ title, synopsis, backdropUrl, mediaId, trailerKey, availabilityStatus, onPlay, onDetails, onAddToList, }) {
    const { activeId, activate, deactivate } = usePreview();
    const timerRef = useRef(null);
    const isActive = !!mediaId && activeId === mediaId;
    const isActiveRef = useRef(isActive);
    isActiveRef.current = isActive;
    const [muted, setMuted] = useState(true);
    useEffect(() => {
        setMuted(true);
    }, [mediaId]);
    useEffect(() => {
        if (!mediaId || !trailerKey || isPointerCoarse())
            return;
        timerRef.current = setTimeout(() => activate(mediaId, trailerKey), 2000);
        return () => {
            if (timerRef.current)
                clearTimeout(timerRef.current);
            if (isActiveRef.current)
                deactivate();
        };
    }, [mediaId, trailerKey, activate, deactivate]);
    return (_jsxs("div", { className: "relative h-[65vh] min-h-80 overflow-hidden", children: [backdropUrl ? (_jsx("img", { src: backdropUrl, alt: "", "aria-hidden": "true", className: "absolute inset-0 w-full h-full object-cover" })) : (_jsx("div", { className: "absolute inset-0 bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f]" })), trailerKey && (_jsx(PreviewPlayer, { trailerKey: trailerKey, active: isActive, muted: muted })), _jsx("div", { className: "absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/70 to-transparent" }), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" }), isActive && (_jsx("button", { onClick: () => setMuted((m) => !m), className: "absolute bottom-4 right-4 z-10 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors border border-white/20", "aria-label": muted ? 'Activer le son' : 'Couper le son', children: muted ? 'Son coupé' : 'Son activé' })), _jsxs("div", { className: "relative h-full flex flex-col justify-end px-4 md:px-8 pb-6 md:pb-10 max-w-2xl", children: [_jsx("h1", { className: "text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 drop-shadow-lg", children: title }), synopsis && (_jsx("p", { className: "text-gray-300 text-sm leading-relaxed mb-6 line-clamp-2 md:line-clamp-3", children: synopsis })), _jsxs("div", { className: "flex flex-wrap gap-2", children: [availabilityStatus === 'AVAILABLE' && onPlay && (_jsx(Button, { onClick: onPlay, children: "Lire" })), onDetails && (_jsx(Button, { variant: "secondary", onClick: onDetails, children: "Plus d'infos" })), onAddToList && (_jsx(Button, { variant: "secondary", onClick: onAddToList, children: "+ Ma Liste" }))] })] })] }));
}
//# sourceMappingURL=HeroSection.js.map