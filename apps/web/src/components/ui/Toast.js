import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useState } from 'react';
const ToastContext = createContext({ show: () => { } });
export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const show = useCallback((message, type) => {
        const id = Date.now();
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    }, []);
    return (_jsxs(ToastContext.Provider, { value: { show }, children: [children, _jsx("div", { "aria-live": "polite", className: "fixed bottom-4 right-4 flex flex-col gap-2 z-[100] pointer-events-none", children: toasts.map((t) => (_jsx("div", { className: `px-4 py-3 rounded-lg text-white text-sm shadow-lg pointer-events-auto ${t.type === 'success' ? 'bg-green-700' : 'bg-red-700'}`, children: t.message }, t.id))) })] }));
}
export function useToast() {
    return useContext(ToastContext);
}
//# sourceMappingURL=Toast.js.map