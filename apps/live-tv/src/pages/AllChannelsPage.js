import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { listChannels } from '../lib/api.js';
export default function AllChannelsPage() {
    const [channels, setChannels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    useEffect(() => {
        listChannels()
            .then(setChannels)
            .catch(() => { })
            .finally(() => setIsLoading(false));
    }, []);
    const categories = [...new Set(channels.map((c) => c.category).filter(Boolean))];
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx("span", { className: "w-8 h-8 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" }) }));
    }
    return (_jsxs("div", { className: "p-6 md:p-8", children: [_jsx("h1", { className: "text-2xl font-bold text-white mb-4", children: "Toutes les cha\u00EEnes" }), categories.length > 0 && (_jsx("div", { className: "flex gap-2 overflow-x-auto pb-4 mb-6", style: { scrollbarWidth: 'none' }, children: categories.map((cat) => (_jsx("button", { className: "shrink-0 px-3 py-1 rounded-full text-sm text-gray-400 border border-white/10 hover:border-[#f97316]/40 hover:text-white transition-colors", children: cat }, cat))) })), channels.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center h-64 text-center", children: [_jsx("p", { className: "text-4xl mb-4", children: "\uD83D\uDCE1" }), _jsx("p", { className: "text-gray-400 text-sm max-w-sm", children: "Aucune cha\u00EEne disponible. Le catalogue sera disponible prochainement." })] })) : (_jsx("div", { className: "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4", "aria-label": "Grille de cha\u00EEnes", children: channels.map((channel) => (_jsxs("div", { className: "bg-[#111118] border border-white/5 rounded-lg p-4 flex flex-col items-center gap-2 hover:border-[#f97316]/30 transition-colors cursor-pointer", children: [channel.logoUrl ? (_jsx("img", { src: channel.logoUrl, alt: channel.name, className: "w-12 h-12 object-contain rounded" })) : (_jsx("div", { className: "w-12 h-12 bg-[#1a1a24] rounded flex items-center justify-center text-[#f97316] font-bold text-lg", children: channel.name.charAt(0).toUpperCase() })), _jsx("span", { className: "text-white text-xs font-medium text-center truncate w-full", children: channel.name })] }, channel.id))) }))] }));
}
//# sourceMappingURL=AllChannelsPage.js.map