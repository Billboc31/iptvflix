import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useFeedback } from '../../hooks/useFeedback.js';
const BUTTONS = [
    { type: 'LIKE', label: "J'aime", icon: '👍' },
    { type: 'DISLIKE', label: "Je n'aime pas", icon: '👎' },
    { type: 'NOT_INTERESTED', label: 'Pas intéressé', icon: '✕' },
];
export default function FeedbackButtons({ mediaType, mediaId }) {
    const { get, set, clear } = useFeedback();
    const current = get(mediaType, mediaId);
    const handleClick = (type) => {
        if (current?.feedback === type) {
            clear(mediaType, mediaId);
        }
        else {
            set(mediaType, mediaId, type);
        }
    };
    return (_jsx("div", { className: "flex gap-2", children: BUTTONS.map(({ type, label, icon }) => (_jsxs("button", { onClick: () => handleClick(type), "aria-label": label, title: label, "aria-pressed": current?.feedback === type, className: `flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium transition-colors ${current?.feedback === type
                ? 'bg-white/20 border-white text-white'
                : 'border-white/40 text-white hover:bg-white/10'}`, children: [_jsx("span", { className: "text-lg leading-none", children: icon }), _jsx("span", { children: label })] }, type))) }));
}
//# sourceMappingURL=FeedbackButtons.js.map