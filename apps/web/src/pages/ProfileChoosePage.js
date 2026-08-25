import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.js';
import { useInteractionEvents } from '../hooks/useInteractionEvents.js';
import ProfileAvatar from '../components/ProfileAvatar.js';
import Spinner from '../components/ui/Spinner.js';
export default function ProfileChoosePage() {
    const { profiles, isLoading, selectProfile } = useProfile();
    const [selecting, setSelecting] = useState(null);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { emit: emitEvent } = useInteractionEvents();
    async function handleSelect(profileId) {
        setSelecting(profileId);
        setError(null);
        try {
            await selectProfile(profileId);
            emitEvent({ eventType: 'PROFILE_SELECTED', clientType: 'web' });
            navigate('/', { replace: true });
        }
        catch {
            setError('Impossible de sélectionner ce profil. Veuillez réessayer.');
            setSelecting(null);
        }
    }
    if (isLoading) {
        return (_jsx("div", { className: "fixed inset-0 bg-[#0a0a0f] flex items-center justify-center", children: _jsx(Spinner, {}) }));
    }
    return (_jsxs("div", { className: "fixed inset-0 bg-[#0a0a0f] flex flex-col items-center justify-center px-4", children: [_jsx("h1", { className: "text-4xl font-bold text-white mb-12 tracking-tight", children: "Qui regarde ?" }), error && (_jsx("p", { className: "text-red-400 text-sm mb-6", role: "alert", children: error })), profiles.length === 0 && (_jsx("p", { className: "text-gray-400 text-sm mb-8 text-center max-w-sm", children: "Aucun profil n\u2019est li\u00E9 \u00E0 ce compte. Cr\u00E9ez-en un pour continuer." })), _jsx("div", { className: "flex flex-wrap gap-8 justify-center max-w-2xl", children: profiles.map((profile) => {
                    const isSelecting = selecting === profile.id;
                    return (_jsxs("button", { onClick: () => handleSelect(profile.id), disabled: selecting !== null, "aria-label": profile.isKids ? `${profile.name} — Profil enfant` : profile.name, className: "flex flex-col items-center gap-3 group focus:outline-none disabled:opacity-60", children: [_jsxs("div", { className: "relative transition-transform group-hover:scale-110 group-focus:scale-110", children: [_jsx(ProfileAvatar, { avatarKey: profile.avatarKey, name: profile.name, size: 96, isKids: profile.isKids }), isSelecting && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center rounded-full bg-black/50", children: _jsx("span", { className: "w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" }) }))] }), _jsx("span", { className: "text-gray-300 text-sm font-medium group-hover:text-white group-focus:text-white transition-colors", children: profile.name })] }, profile.id));
                }) }), _jsx("div", { className: "mt-12 flex flex-wrap gap-3 justify-center", children: profiles.length === 0 ? (_jsx("button", { onClick: () => navigate('/profiles/create'), className: "text-sm text-white border border-white/30 hover:bg-white/10 px-5 py-2 rounded-md transition-colors", children: "Cr\u00E9er un profil" })) : (_jsx("button", { onClick: () => navigate('/profiles'), className: "text-sm text-gray-500 hover:text-white border border-white/10 hover:border-white/30 px-5 py-2 rounded-md transition-colors", children: "G\u00E9rer les profils" })) })] }));
}
//# sourceMappingURL=ProfileChoosePage.js.map