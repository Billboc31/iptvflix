import { jsx as _jsx } from "react/jsx-runtime";
export default function Skeleton({ className = '', width, height, style }) {
    return (_jsx("div", { className: `animate-pulse bg-[#1a1a24] rounded ${className}`, style: { width, height, ...style }, "aria-hidden": "true" }));
}
//# sourceMappingURL=Skeleton.js.map