import { jsx as _jsx } from "react/jsx-runtime";
export default function Skeleton({ className = '', width, height }) {
    return (_jsx("div", { className: `animate-pulse bg-[#1a1a24] rounded ${className}`, style: { width, height }, "aria-hidden": "true" }));
}
//# sourceMappingURL=Skeleton.js.map