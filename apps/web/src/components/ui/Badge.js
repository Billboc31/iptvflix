import { jsx as _jsx } from "react/jsx-runtime";
const VARIANTS = {
    default: 'bg-white/10 text-gray-300',
    accent: 'bg-[#e50914] text-white',
    available: 'bg-green-700 text-green-100',
    unavailable: 'bg-gray-700 text-gray-400',
    upcoming: 'bg-amber-700 text-amber-100',
    quality: 'bg-blue-700 text-blue-100',
    info: 'bg-[#1a1a24] text-gray-300 border border-white/10',
};
export default function Badge({ variant = 'default', children, className = '' }) {
    return (_jsx("span", { className: `inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${VARIANTS[variant]} ${className}`, children: children }));
}
//# sourceMappingURL=Badge.js.map