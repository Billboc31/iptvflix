import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
export default class ErrorBoundary extends Component {
    state = { hasError: false, message: null };
    static getDerivedStateFromError(error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { hasError: true, message };
    }
    componentDidCatch(_error, info) {
        console.error('[iptvflix] Uncaught render error', info.componentStack);
    }
    render() {
        if (this.state.hasError) {
            if (this.props.fallback)
                return this.props.fallback;
            return (_jsx("div", { className: "fixed inset-0 bg-[#0a0a0f] flex items-center justify-center p-8", children: _jsxs("div", { className: "max-w-md text-center", children: [_jsx("p", { className: "text-4xl mb-4", children: "\u26A0\uFE0F" }), _jsx("h1", { className: "text-xl font-bold text-white mb-2", children: "Une erreur est survenue" }), _jsx("p", { className: "text-gray-400 text-sm mb-6", children: "L'application a rencontr\u00E9 un probl\u00E8me inattendu. Veuillez recharger la page." }), _jsx("button", { type: "button", onClick: () => window.location.reload(), className: "px-4 py-2 bg-white text-black rounded font-medium text-sm hover:bg-gray-200 transition-colors", children: "Recharger" })] }) }));
        }
        return this.props.children;
    }
}
//# sourceMappingURL=ErrorBoundary.js.map