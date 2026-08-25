import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Button from './Button.js';
export default function ErrorState({ message = 'Une erreur est survenue.', onRetry, }) {
    return (_jsxs("div", { role: "alert", className: "flex flex-col items-center justify-center py-16 px-4 text-center", children: [_jsx("div", { className: "text-5xl mb-4 select-none", children: "\u26A0\uFE0F" }), _jsx("h3", { className: "text-xl font-semibold text-white mb-2", children: "Erreur" }), _jsx("p", { className: "text-gray-400 mb-6 max-w-md", children: message }), onRetry && _jsx(Button, { onClick: onRetry, children: "R\u00E9essayer" })] }));
}
//# sourceMappingURL=ErrorState.js.map