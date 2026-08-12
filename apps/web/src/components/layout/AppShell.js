import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import LeftNav from './LeftNav.js';
import TopBar from './TopBar.js';
export default function AppShell() {
    return (_jsxs("div", { className: "flex min-h-screen bg-[#0a0a0f]", children: [_jsx(LeftNav, {}), _jsxs("div", { className: "flex-1 ml-60 flex flex-col min-h-screen", children: [_jsx(TopBar, {}), _jsx("main", { className: "flex-1", children: _jsx(Outlet, {}) })] })] }));
}
//# sourceMappingURL=AppShell.js.map