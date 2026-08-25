import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
const SETTINGS_ITEMS = [
    { label: 'Sources', to: '/sources' },
    { label: 'Lecture', to: '/settings/playback' },
    { label: 'Appareils', to: '/settings/devices' },
];
export default function SettingsMenu() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);
    const location = useLocation();
    useEffect(() => {
        if (!open)
            return;
        const handleMouseDown = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);
    // Close menu on route change
    useEffect(() => {
        setOpen(false);
    }, [location.pathname]);
    return (_jsxs("div", { ref: containerRef, className: "relative", children: [_jsx("button", { onClick: () => setOpen((v) => !v), "aria-label": "Param\u00E8tres", "aria-haspopup": "true", "aria-expanded": open, className: "text-gray-400 hover:text-white transition-colors p-1 text-sm", children: "\u2699\uFE0F" }), open && (_jsx("div", { role: "menu", className: "absolute right-0 mt-1 w-44 bg-[#0a0a0f] border border-white/10 rounded-lg shadow-xl z-50 py-1", children: SETTINGS_ITEMS.map((item) => (_jsx(NavLink, { to: item.to, role: "menuitem", onClick: () => setOpen(false), className: ({ isActive }) => `block px-4 py-2 text-sm transition-colors ${isActive ? 'text-white bg-white/10' : 'text-gray-300 hover:text-white hover:bg-white/5'}`, children: item.label }, item.to))) }))] }));
}
//# sourceMappingURL=SettingsMenu.js.map