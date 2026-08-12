import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export default function TrailerPlayer({ trailerKey, title }) {
    const [playing, setPlaying] = useState(false);
    if (!trailerKey)
        return null;
    if (playing) {
        return (_jsx("div", { className: "relative w-full aspect-video rounded-xl overflow-hidden bg-black", children: _jsx("iframe", { src: `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`, title: `Trailer — ${title}`, allow: "autoplay; encrypted-media; picture-in-picture", allowFullScreen: true, className: "absolute inset-0 w-full h-full" }) }));
    }
    return (_jsxs("div", { className: "mb-6", children: [_jsx("p", { className: "text-xs font-medium text-gray-400 uppercase tracking-wide mb-2", children: "Bande-annonce" }), _jsxs("button", { type: "button", onClick: () => setPlaying(true), className: "flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-white text-sm font-medium", "aria-label": `Lire la bande-annonce de ${title}`, children: [_jsx("span", { className: "text-xl", children: "\u25B6" }), "Lire la bande-annonce"] })] }));
}
//# sourceMappingURL=TrailerPlayer.js.map