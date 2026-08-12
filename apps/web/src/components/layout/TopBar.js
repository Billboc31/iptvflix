import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
export default function TopBar() {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const handleSubmit = (e) => {
        e.preventDefault();
        const q = query.trim();
        if (q)
            navigate(`/search?q=${encodeURIComponent(q)}`);
    };
    return (_jsx("header", { className: "sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur border-b border-white/5 px-8 py-3", children: _jsxs("form", { onSubmit: handleSubmit, className: "flex items-center gap-3 max-w-md", children: [_jsx("span", { className: "text-gray-500 text-sm", children: "\uD83D\uDD0D" }), _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Rechercher films, s\u00E9ries\u2026", className: "flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e50914]/50" })] }) }));
}
//# sourceMappingURL=TopBar.js.map