import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav.js';
export default function AppShell() {
    return (_jsxs("div", { className: "flex flex-col min-h-screen bg-[#0a0a0f]", children: [_jsx(TopNav, {}), _jsx("main", { className: "flex-1", children: _jsx(Outlet, {}) })] }));
}
//# sourceMappingURL=AppShell.js.map