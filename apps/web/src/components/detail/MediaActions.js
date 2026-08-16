import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button.js';
import WatchlistButton from '../content/WatchlistButton.js';
import FeedbackButtons from '../content/FeedbackButtons.js';
export default function MediaActions({ mediaType, mediaId, availabilityStatus, playRoute, onPlayOnTv, showPlayOnTv, }) {
    const navigate = useNavigate();
    const isAvailable = availabilityStatus === 'AVAILABLE';
    return (_jsxs("div", { className: "flex flex-wrap gap-3 mb-6", children: [_jsx(Button, { variant: "ghost", className: "min-h-[44px]", onClick: () => navigate(-1), children: "\u2190 Retour" }), playRoute != null && (isAvailable ? (_jsx(Button, { className: "min-h-[44px]", onClick: () => navigate(playRoute), "aria-label": "Lecture", children: "\u25B6 Lecture" })) : (_jsx(Button, { className: "min-h-[44px]", disabled: true, "aria-label": "Non disponible", children: "\u25B6 Non disponible" }))), showPlayOnTv && (_jsx(Button, { variant: "secondary", className: "min-h-[44px]", onClick: onPlayOnTv, children: "\uD83D\uDCFA Lire sur TV" })), _jsx(WatchlistButton, { mediaType: mediaType, mediaId: mediaId }), _jsx(FeedbackButtons, { mediaType: mediaType, mediaId: mediaId })] }));
}
//# sourceMappingURL=MediaActions.js.map