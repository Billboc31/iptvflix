import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AVATAR_KEYS } from '@iptvflix/api-contracts';
import { getAvatarUrl } from '../lib/avatars.js';
export default function AvatarPicker({ value, onChange }) {
    return (_jsxs("fieldset", { children: [_jsx("legend", { className: "block text-sm font-medium text-gray-300 mb-3", children: "Choisir un avatar" }), _jsx("div", { className: "grid grid-cols-4 gap-3", children: AVATAR_KEYS.map((key) => {
                    const selected = value === key;
                    return (_jsxs("label", { className: `cursor-pointer rounded-full flex items-center justify-center p-0.5 transition-all ${selected ? 'ring-2 ring-[#e50914] ring-offset-2 ring-offset-[#0a0a0f]' : 'hover:opacity-90'}`, children: [_jsx("input", { type: "radio", name: "avatarKey", value: key, checked: selected, onChange: () => onChange(key), className: "sr-only" }), _jsx("img", { src: getAvatarUrl(key), alt: key, width: 56, height: 56, className: "rounded-full w-14 h-14 object-cover", draggable: false })] }, key));
                }) })] }));
}
//# sourceMappingURL=AvatarPicker.js.map