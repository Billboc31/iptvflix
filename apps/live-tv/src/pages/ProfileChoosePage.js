import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.js';
export default function ProfileChoosePage() {
    const { profiles, isLoading, selectProfile } = useProfile();
    const [selecting, setSelecting] = useState(null);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    async function handleSelect(profileId) {
        setSelecting(profileId);
        setError(null);
        try {
            await selectProfile(profileId);
            navigate('/', { replace: true });
        }
        catch {
            setError('Impossible de sélectionner ce profil. Veuillez réessayer.');
            setSelecting(null);
        }
    }
    if (isLoading) {
        return (_jsx("div", { className: "fixed inset-0 bg-[#0a0a0f] flex items-center justify-center", children: _jsx("span", { className: "w-10 h-10 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" }) }));
    }
    return (_jsxs("div", { className: "fixed inset-0 bg-[#0a0a0f] flex flex-col items-center justify-center px-4", children: [_jsx("h1", { className: "text-4xl font-bold text-white mb-12 tracking-tight", children: "Qui regarde ?" }), error && (_jsx("p", { className: "text-red-400 text-sm mb-6", role: "alert", children: error })), _jsx("div", { className: "flex flex-wrap gap-8 justify-center max-w-2xl", children: profiles.map((profile) => {
                    const isSelecting = selecting === profile.id;
                    return (_jsxs("button", { onClick: () => handleSelect(profile.id), disabled: selecting !== null, "aria-label": profile.name, className: "flex flex-col items-center gap-3 group focus:outline-none disabled:opacity-60", children: [_jsxs("div", { className: "relative w-24 h-24 rounded-full bg-[#1a1a24] border-2 border-white/10 group-hover:border-[#f97316] transition-colors flex items-center justify-center", children: [_jsx("span", { className: "text-3xl font-bold text-white", children: profile.name.charAt(0).toUpperCase() }), isSelecting && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center rounded-full bg-black/50", children: _jsx("span", { className: "w-6 h-6 border-2 border-white/40 border-t-[#f97316] rounded-full animate-spin" }) }))] }), _jsx("span", { className: "text-gray-300 text-sm font-medium group-hover:text-white transition-colors", children: profile.name })] }, profile.id));
                }) })] }));
}
//# sourceMappingURL=ProfileChoosePage.js.map