import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
export default function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuth();
    if (isLoading) {
        return (_jsx("div", { className: "fixed inset-0 bg-[#0a0a0f] flex items-center justify-center", children: _jsx("span", { className: "w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" }) }));
    }
    if (!isAuthenticated)
        return _jsx(Navigate, { to: "/login", replace: true });
    return children ? _jsx(_Fragment, { children: children }) : _jsx(Outlet, {});
}
//# sourceMappingURL=ProtectedRoute.js.map