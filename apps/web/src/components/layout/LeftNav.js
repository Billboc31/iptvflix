import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
const NAV_ITEMS = [
    { label: 'Accueil', to: '/', icon: '🏠' },
    { label: 'Films', to: '/movies', icon: '🎬' },
    { label: 'Séries', to: '/series', icon: '📺' },
    { label: 'Radar Cinéma', to: '/radar', icon: '🎭', disabled: true },
    { label: 'Ma Liste', to: '/list', icon: '❤️', disabled: true },
    { label: 'Historique', to: '/history', icon: '🕐', disabled: true },
    { label: 'Recherche', to: '/search', icon: '🔍' },
    { label: 'Sources IPTV', to: '/sources', icon: '📡' },
    { label: 'Préférences lecture', to: '/settings/playback', icon: '⚙️' },
];
export default function LeftNav() {
    return (_jsxs("nav", { className: "fixed top-0 left-0 h-screen w-60 bg-[#111118] border-r border-white/5 flex flex-col z-40", children: [_jsx("div", { className: "px-6 py-6 border-b border-white/5", children: _jsx("span", { className: "text-2xl font-bold text-[#e50914] tracking-tight", children: "IPTVFlix" }) }), _jsx("div", { className: "flex-1 py-4 overflow-y-auto", children: NAV_ITEMS.map((item) => item.disabled ? (_jsxs("div", { className: "flex items-center gap-3 px-6 py-3 text-sm text-gray-600 opacity-40 cursor-not-allowed select-none", title: "Fonctionnalit\u00E9 \u00E0 venir", children: [_jsx("span", { className: "text-base", children: item.icon }), _jsx("span", { children: item.label })] }, item.to)) : (_jsxs(NavLink, { to: item.to, end: item.to === '/', className: ({ isActive }) => `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${isActive
                        ? 'text-white bg-white/10 border-r-2 border-[#e50914]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'}`, children: [_jsx("span", { className: "text-base", children: item.icon }), _jsx("span", { children: item.label })] }, item.to))) }), _jsx("div", { className: "px-6 py-4 border-t border-white/5", children: _jsx("p", { className: "text-xs text-gray-600", children: "v0.1.0" }) })] }));
}
//# sourceMappingURL=LeftNav.js.map