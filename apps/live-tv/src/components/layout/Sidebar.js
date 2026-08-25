import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
const NAV_ITEMS = [
    { label: 'Accueil TV', to: '/', end: true, icon: '📺' },
    { label: 'Favoris', to: '/favorites', icon: '❤️' },
    { label: 'Récemment regardées', to: '/recent', icon: '🕐' },
    { label: 'Guide TV', to: '/guide', icon: '📅' },
    { label: 'Toutes les chaînes', to: '/channels', icon: '📡' },
];
export default function Sidebar() {
    return (_jsxs("aside", { className: "w-16 md:w-56 shrink-0 flex flex-col bg-[#111118] border-r border-white/5 min-h-screen", children: [_jsxs("div", { className: "px-3 md:px-4 py-5 border-b border-white/5", children: [_jsx("span", { className: "hidden md:block text-lg font-bold text-[#f97316] tracking-tight", children: "IPTVFlix" }), _jsx("span", { className: "md:hidden text-lg font-bold text-[#f97316]", children: "IV" })] }), _jsx("nav", { className: "flex flex-col gap-1 p-2 flex-1", "aria-label": "Navigation Live TV", children: NAV_ITEMS.map((item) => (_jsxs(NavLink, { to: item.to, end: item.end, className: ({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                        ? 'bg-[#f97316]/15 text-[#f97316]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'}`, "aria-label": item.label, children: [_jsx("span", { className: "shrink-0 text-base", children: item.icon }), _jsx("span", { className: "hidden md:block truncate", children: item.label })] }, item.to))) })] }));
}
//# sourceMappingURL=Sidebar.js.map