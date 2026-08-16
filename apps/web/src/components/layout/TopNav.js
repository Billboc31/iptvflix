import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import SettingsMenu from './SettingsMenu.js';
const NAV_ITEMS = [
    { label: 'Accueil', to: '/', end: true },
    { label: 'Films', to: '/movies' },
    { label: 'Séries', to: '/series' },
    { label: 'Ma Liste', to: '/my-list' },
    { label: 'Nouveautés', to: '/arrivals' },
];
export default function TopNav() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const handleSubmit = (e) => {
        e.preventDefault();
        const q = query.trim();
        if (q)
            navigate(`/search?q=${encodeURIComponent(q)}`);
    };
    return (_jsxs("header", { className: "sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5", children: [_jsxs("div", { className: "flex items-center h-14 px-4 md:px-8 gap-6", children: [_jsx(NavLink, { to: "/", className: "text-xl font-bold text-[#e50914] tracking-tight shrink-0", children: "IPTVFlix" }), _jsx("nav", { className: "hidden md:flex items-center gap-1 flex-1", "aria-label": "Navigation principale", children: NAV_ITEMS.map((item) => (_jsx(NavLink, { to: item.to, end: item.end, className: ({ isActive }) => `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
                                ? 'text-white bg-white/10'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'}`, children: item.label }, item.to))) }), _jsxs("div", { className: "ml-auto flex items-center gap-3", children: [_jsx("form", { onSubmit: handleSubmit, className: "hidden md:flex items-center", children: _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Rechercher\u2026", "aria-label": "Rechercher", className: "w-40 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e50914]/50" }) }), _jsx("button", { className: "md:hidden text-gray-400 hover:text-white p-1", onClick: () => navigate('/search'), "aria-label": "Rechercher", children: "\uD83D\uDD0D" }), _jsx(SettingsMenu, {})] })] }), _jsx("nav", { className: "flex md:hidden overflow-x-auto border-t border-white/5", "aria-label": "Navigation mobile", style: { scrollbarWidth: 'none' }, children: NAV_ITEMS.map((item) => (_jsx(NavLink, { to: item.to, end: item.end, className: ({ isActive }) => `shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${isActive
                        ? 'text-white border-b-2 border-[#e50914]'
                        : 'text-gray-400 hover:text-white'}`, children: item.label }, item.to))) })] }));
}
//# sourceMappingURL=TopNav.js.map