import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Badge from '../ui/Badge.js';
const STATUS_VARIANT = {
    DONE: 'available',
    FAILED: 'unavailable',
    RUNNING: 'info',
    PENDING: 'info',
};
function fmt(iso) {
    if (!iso)
        return '—';
    return new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}
export default function SyncRunList({ runs }) {
    if (runs.length === 0) {
        return _jsx("p", { className: "text-gray-500 text-sm py-4", children: "Aucune synchronisation effectu\u00E9e." });
    }
    return (_jsx("div", { className: "overflow-x-auto rounded-xl border border-white/5", children: _jsxs("table", { className: "w-full text-sm text-left", children: [_jsx("thead", { className: "bg-[#1a1a24]", children: _jsxs("tr", { className: "text-gray-400", children: [_jsx("th", { className: "px-4 py-3 font-medium", children: "Statut" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "D\u00E9but" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Fin" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "Films" }), _jsx("th", { className: "px-4 py-3 font-medium text-right", children: "S\u00E9ries" }), _jsx("th", { className: "px-4 py-3 font-medium", children: "Erreur" })] }) }), _jsx("tbody", { children: runs.map((run) => (_jsxs("tr", { className: "border-t border-white/5 hover:bg-white/[0.02]", children: [_jsx("td", { className: "px-4 py-3", children: _jsx(Badge, { variant: STATUS_VARIANT[run.status] ?? 'info', children: run.status }) }), _jsx("td", { className: "px-4 py-3 text-gray-300", children: fmt(run.startedAt) }), _jsx("td", { className: "px-4 py-3 text-gray-300", children: fmt(run.finishedAt) }), _jsxs("td", { className: "px-4 py-3 text-right text-gray-300", children: ["+", run.moviesAdded] }), _jsxs("td", { className: "px-4 py-3 text-right text-gray-300", children: ["+", run.seriesAdded] }), _jsx("td", { className: "px-4 py-3 text-red-400 text-xs max-w-xs truncate", children: run.error ?? '—' })] }, run.id))) })] }) }));
}
//# sourceMappingURL=SyncRunList.js.map