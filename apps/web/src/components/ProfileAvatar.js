import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getAvatarUrl } from '../lib/avatars.js';
export default function ProfileAvatar({ avatarKey, name, size = 48, isActive = false, isKids = false, className = '' }) {
    const url = getAvatarUrl(avatarKey);
    const ring = isActive ? 'ring-2 ring-[#e50914] ring-offset-2 ring-offset-[#0a0a0f]' : '';
    return (_jsxs("div", { className: `relative inline-flex shrink-0 ${className}`, style: { width: size, height: size }, children: [_jsx("img", { src: url, alt: name, width: size, height: size, className: `rounded-full object-cover w-full h-full ${ring}`, draggable: false }), isKids && (_jsx("span", { "aria-label": "Profil enfant", className: "absolute bottom-0 right-0 bg-blue-500 text-white text-[8px] font-bold rounded-full px-1 leading-4", style: { fontSize: Math.max(8, size * 0.18) }, children: "Kids" }))] }));
}
//# sourceMappingURL=ProfileAvatar.js.map