import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { updateProfile } from '../lib/api.js';
import { ApiError } from '../lib/api.js';
import { useProfile } from '../context/ProfileContext.js';
import AvatarPicker from '../components/AvatarPicker.js';
import Button from '../components/ui/Button.js';
import Spinner from '../components/ui/Spinner.js';
export default function ProfileEditPage() {
    const { profileId } = useParams();
    const { profiles, refreshProfiles } = useProfile();
    const navigate = useNavigate();
    const profile = profiles.find((p) => p.id === profileId);
    const [name, setName] = useState('');
    const [avatarKey, setAvatarKey] = useState(null);
    const [isKids, setIsKids] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (profile) {
            setName(profile.name);
            setAvatarKey(profile.avatarKey);
            setIsKids(profile.isKids);
        }
    }, [profile]);
    if (!profile) {
        return (_jsx("div", { className: "flex items-center justify-center h-64", children: _jsx(Spinner, {}) }));
    }
    async function handleSubmit(e) {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Le nom est requis.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await updateProfile(profile.id, { name: trimmed, avatarKey, isKids });
            await refreshProfiles();
            navigate('/profiles');
        }
        catch (err) {
            if (err instanceof ApiError && err.status === 400) {
                setError(err.message);
            }
            else {
                setError('Impossible de modifier le profil.');
            }
        }
        finally {
            setSaving(false);
        }
    }
    return (_jsxs("div", { className: "max-w-md mx-auto px-6 py-8", children: [_jsx("h1", { className: "text-2xl font-bold text-white mb-1", children: "Modifier le profil" }), _jsx("p", { className: "text-sm text-gray-400 mb-6", children: "Mode \u00E9dition \u2014 cliquer ici ne s\u00E9lectionne pas ce profil." }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-300 mb-1", htmlFor: "profile-name", children: ["Nom ", _jsx("span", { className: "text-red-400", children: "*" })] }), _jsx("input", { id: "profile-name", type: "text", value: name, onChange: (e) => setName(e.target.value), maxLength: 50, required: true, autoFocus: true, className: "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-white/30 text-sm" })] }), _jsx(AvatarPicker, { value: avatarKey, onChange: setAvatarKey }), _jsxs("label", { className: "flex items-center gap-3 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: isKids, onChange: (e) => setIsKids(e.target.checked), className: "w-4 h-4 accent-[#e50914]" }), _jsx("span", { className: "text-sm text-gray-300", children: "Profil enfant" })] }), error && (_jsx("p", { className: "text-red-400 text-sm", role: "alert", children: error })), _jsxs("div", { className: "flex gap-3", children: [_jsx(Button, { type: "submit", disabled: saving, children: saving ? 'Sauvegarde…' : 'Enregistrer' }), _jsx(Button, { type: "button", variant: "ghost", onClick: () => navigate('/profiles'), children: "Annuler" })] })] })] }));
}
//# sourceMappingURL=ProfileEditPage.js.map