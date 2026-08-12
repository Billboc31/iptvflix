import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import Badge from '../ui/Badge.js';
import Button from '../ui/Button.js';
function formatDate(iso) {
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}
const STATUS_VARIANT = {
    DONE: 'available',
    FAILED: 'unavailable',
    RUNNING: 'info',
    PENDING: 'info',
};
export default function SyncStatusBanner({ latestRun, onSync, syncing = false, }) {
    return (_jsxs("div", { className: "bg-[#1a1a24] border border-white/5 rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap", children: [_jsx("div", { className: "flex items-center gap-3", children: latestRun ? (_jsxs(_Fragment, { children: [_jsx(Badge, { variant: STATUS_VARIANT[latestRun.status] ?? 'info', children: latestRun.status }), _jsxs("span", { className: "text-gray-400 text-sm", children: ["Derni\u00E8re synchro : ", formatDate(latestRun.startedAt)] }), latestRun.status === 'DONE' && (_jsxs("span", { className: "text-gray-500 text-xs", children: ["+", latestRun.moviesAdded, " films \u00B7 +", latestRun.seriesAdded, " s\u00E9ries"] }))] })) : (_jsx("span", { className: "text-gray-400 text-sm", children: "Jamais synchronis\u00E9" })) }), _jsx(Button, { size: "sm", variant: "secondary", loading: syncing, onClick: onSync, children: "Synchroniser" })] }));
}
//# sourceMappingURL=SyncStatusBanner.js.map