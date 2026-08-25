import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar.js';
import TopBar from './TopBar.js';
export default function AppShell() {
    return (_jsxs("div", { className: "flex flex-col min-h-screen bg-[#0a0a0f]", children: [_jsx(TopBar, {}), _jsxs("div", { className: "flex flex-1", children: [_jsx(Sidebar, {}), _jsx("main", { className: "flex-1 overflow-auto", children: _jsx(Outlet, {}) })] })] }));
}
//# sourceMappingURL=AppShell.js.map