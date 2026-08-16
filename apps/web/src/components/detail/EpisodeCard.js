import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../ui/Toast.js';
import DevicePickerModal from '../devices/DevicePickerModal.js';
export default function EpisodeCard({ episode, devices = [], progressMs = 0 }) {
    const navigate = useNavigate();
    const toast = useToast();
    const [pickerOpen, setPickerOpen] = useState(false);
    const durationLabel = episode.durationMinutes ? `${episode.durationMinutes} min` : null;
    const airLabel = episode.airDate
        ? new Date(episode.airDate).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' })
        : null;
    const isUnavailable = episode.availabilityStatus === 'UNAVAILABLE';
    return (_jsxs("div", { className: `flex gap-3 md:gap-4 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${isUnavailable ? 'opacity-60' : ''}`, children: [_jsx("span", { className: "flex-shrink-0 w-7 text-right text-gray-500 text-sm pt-1 font-mono", children: episode.episodeNumber }), _jsx("div", { className: "flex-shrink-0 w-24 md:w-36 aspect-video bg-[#1a1a24] rounded overflow-hidden flex items-center justify-center", children: _jsx("span", { className: "text-gray-600 text-2xl", "aria-hidden": "true", children: "\uD83C\uDFAC" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-start gap-2 mb-1", children: [_jsx("span", { className: "text-gray-100 text-sm font-medium leading-tight", children: episode.title ?? `Épisode ${episode.episodeNumber}` }), episode.watchState === 'watched' && (_jsx("span", { "aria-label": "Vu", className: "text-green-400 text-xs font-medium flex-shrink-0", children: "\u2713 Vu" })), episode.watchState === 'in_progress' && (_jsx("span", { "aria-label": "En cours", className: "text-blue-400 text-xs font-medium flex-shrink-0", children: "\u25D1 En cours" }))] }), episode.synopsis && (_jsx("p", { className: "text-gray-400 text-xs leading-relaxed line-clamp-2 mb-2", children: episode.synopsis })), _jsxs("div", { className: "flex flex-wrap items-center gap-3 text-gray-500 text-xs", children: [durationLabel && _jsx("span", { children: durationLabel }), airLabel && _jsx("span", { children: airLabel }), isUnavailable ? (_jsx("span", { className: "text-gray-600", children: "Indisponible" })) : (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", onClick: () => navigate(`/player/episode/${episode.id}${episode.selectedVariantId ? `?availabilityId=${episode.selectedVariantId}` : ''}`), className: "inline-flex items-center min-h-[44px] text-[#e50914] hover:text-[#e50914]/80 font-medium transition-colors", "aria-label": `Lire l'épisode ${episode.episodeNumber}`, children: "\u25B6 Lire" }), devices.length > 0 && (_jsx("button", { type: "button", onClick: () => setPickerOpen(true), className: "inline-flex items-center min-h-[44px] text-blue-400 hover:text-blue-300 font-medium transition-colors", "aria-label": `Lire l'épisode ${episode.episodeNumber} sur TV`, children: "\uD83D\uDCFA TV" }))] }))] })] }), pickerOpen && (_jsx(DevicePickerModal, { open: pickerOpen, onClose: () => setPickerOpen(false), devices: devices, mediaType: "episode", mediaId: episode.id, availabilityId: episode.selectedVariantId, progressMs: progressMs, onFastPath: (name, state) => {
                    if (state === 'delivered') {
                        toast.show(`Lecture lancée sur ${name}`, 'success');
                    }
                    else if (state === 'device-offline') {
                        toast.show(`${name} est hors ligne`, 'error');
                    }
                    else {
                        toast.show('Erreur lors de l\'envoi de la commande', 'error');
                    }
                } }))] }));
}
//# sourceMappingURL=EpisodeCard.js.map