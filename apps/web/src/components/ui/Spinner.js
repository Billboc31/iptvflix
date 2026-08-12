import { jsx as _jsx } from "react/jsx-runtime";
export default function Spinner({ className = '' }) {
    return (_jsx("div", { className: `flex items-center justify-center p-8 ${className}`, children: _jsx("div", { className: "w-8 h-8 border-2 border-[#e50914] border-t-transparent rounded-full animate-spin", role: "status", "aria-label": "Chargement\u2026" }) }));
}
//# sourceMappingURL=Spinner.js.map