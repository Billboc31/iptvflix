import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from 'react';
export default function HorizontalRow({ title, children }) {
    const rowRef = useRef(null);
    const scroll = (dir) => {
        rowRef.current?.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' });
    };
    return (_jsxs("section", { className: "mb-8 px-4 md:px-8", children: [_jsx("h2", { className: "text-lg font-semibold text-white mb-3 px-1", children: title }), _jsxs("div", { className: "relative group", children: [_jsx("button", { onClick: () => scroll('left'), "aria-label": "D\u00E9filer \u00E0 gauche", className: "hidden md:flex absolute left-0 top-0 bottom-6 z-10 w-10 items-center justify-center opacity-0 group-hover:opacity-100 bg-gradient-to-r from-[#0a0a0f] to-transparent transition-opacity", children: _jsx("span", { className: "text-white text-lg", children: "\u2039" }) }), _jsx("div", { ref: rowRef, className: "flex gap-3 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory", children: children }), _jsx("button", { onClick: () => scroll('right'), "aria-label": "D\u00E9filer \u00E0 droite", className: "hidden md:flex absolute right-0 top-0 bottom-6 z-10 w-10 items-center justify-center opacity-0 group-hover:opacity-100 bg-gradient-to-l from-[#0a0a0f] to-transparent transition-opacity", children: _jsx("span", { className: "text-white text-lg", children: "\u203A" }) })] })] }));
}
//# sourceMappingURL=HorizontalRow.js.map