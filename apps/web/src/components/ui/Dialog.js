import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function Dialog({ open, onClose, title, children }) {
    if (!open)
        return null;
    return (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4", children: [_jsx("div", { className: "absolute inset-0 bg-black/70 backdrop-blur-sm", onClick: onClose, "aria-hidden": "true" }), _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-labelledby": "dialog-title", className: "relative bg-[#1a1a24] rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto shadow-2xl border border-white/10", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b border-white/10", children: [_jsx("h2", { id: "dialog-title", className: "text-lg font-semibold text-white", children: title }), _jsx("button", { onClick: onClose, "aria-label": "Fermer", className: "text-gray-400 hover:text-white transition-colors text-xl leading-none", children: "\u2715" })] }), _jsx("div", { className: "px-6 py-4", children: children })] })] }));
}
//# sourceMappingURL=Dialog.js.map