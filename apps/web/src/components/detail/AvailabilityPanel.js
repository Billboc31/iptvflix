import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import Badge from '../ui/Badge.js';
import { formatVariantLabel } from '../../lib/variant-label.js';
const COLLAPSED_COUNT = 3;
export default function AvailabilityPanel({ variants, selectedVariantId, onSelectVariant }) {
    const [expanded, setExpanded] = useState(false);
    const available = variants.filter((v) => v.status === 'AVAILABLE');
    if (available.length === 0)
        return null;
    const displayed = expanded ? available : available.slice(0, COLLAPSED_COUNT);
    const hasMore = available.length > COLLAPSED_COUNT;
    return (_jsxs("div", { className: "mb-6", children: [_jsx("p", { className: "text-xs font-medium text-gray-400 uppercase tracking-wide mb-2", children: "Disponibilit\u00E9s" }), _jsx("div", { className: "flex flex-col gap-2", children: displayed.map((v) => (_jsxs("button", { type: "button", onClick: () => onSelectVariant?.(v.id), className: `flex items-center gap-3 px-3 py-2 rounded-lg border text-sm text-left transition-colors ${selectedVariantId === v.id
                        ? 'border-[#e50914] bg-[#e50914]/10 text-white'
                        : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`, "aria-pressed": selectedVariantId === v.id, children: [_jsx("span", { className: "flex-1", children: formatVariantLabel(v, available) }), _jsx(Badge, { variant: "available", children: "Disponible" })] }, v.id))) }), hasMore && !expanded && (_jsxs("button", { type: "button", onClick: () => setExpanded(true), className: "mt-2 text-xs text-gray-400 hover:text-gray-300 underline underline-offset-2", children: ["Voir toutes les versions (", available.length, ")"] }))] }));
}
//# sourceMappingURL=AvailabilityPanel.js.map