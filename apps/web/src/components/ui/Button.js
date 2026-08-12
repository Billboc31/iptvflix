import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const VARIANTS = {
    primary: 'bg-[#e50914] hover:bg-[#e50914]/90 text-white',
    secondary: 'bg-white/10 hover:bg-white/20 text-white border border-white/20',
    ghost: 'hover:bg-white/10 text-gray-300 hover:text-white',
};
const SIZES = {
    sm: 'px-3 py-1 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
};
export default function Button({ variant = 'primary', size = 'md', loading = false, disabled, className = '', children, ...props }) {
    return (_jsxs("button", { ...props, disabled: disabled || loading, className: `inline-flex items-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`, children: [loading && (_jsx("span", { className: "w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" })), children] }));
}
//# sourceMappingURL=Button.js.map