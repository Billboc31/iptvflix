import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function EmptyState({ icon, heading, description, action }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center py-16 px-4 text-center", children: [icon && _jsx("div", { className: "text-6xl mb-4 select-none", children: icon }), _jsx("h3", { className: "text-xl font-semibold text-white mb-2", children: heading }), description && _jsx("p", { className: "text-gray-400 mb-6 max-w-md", children: description }), action && _jsx("div", { children: action })] }));
}
//# sourceMappingURL=EmptyState.js.map