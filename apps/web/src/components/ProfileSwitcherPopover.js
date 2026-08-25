import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfile } from '../context/ProfileContext.js';
import { useAuth } from '../context/AuthContext.js';
import ProfileAvatar from './ProfileAvatar.js';
export default function ProfileSwitcherPopover() {
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState(null);
    const containerRef = useRef(null);
    const { currentProfile, profiles, selectProfile } = useProfile();
    const { logout } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        if (!open)
            return;
        const handleMouseDown = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape')
                setOpen(false);
        };
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);
    async function handleSelect(profileId) {
        if (profileId === currentProfile?.id) {
            setOpen(false);
            return;
        }
        setSwitching(profileId);
        try {
            await selectProfile(profileId);
            setOpen(false);
            navigate('/', { replace: true });
        }
        catch {
            // error handled by context — stay on current profile
        }
        finally {
            setSwitching(null);
        }
    }
    async function handleLogout() {
        setOpen(false);
        await logout();
        navigate('/login', { replace: true });
    }
    if (!currentProfile)
        return null;
    return (_jsxs("div", { ref: containerRef, className: "relative", children: [_jsxs("button", { onClick: () => setOpen((v) => !v), "aria-label": "Changer de profil", "aria-haspopup": "true", "aria-expanded": open, className: "flex items-center gap-2 hover:opacity-80 transition-opacity", children: [_jsx(ProfileAvatar, { avatarKey: currentProfile.avatarKey, name: currentProfile.name, size: 32, isActive: false, isKids: currentProfile.isKids }), _jsx("span", { className: "hidden sm:block text-sm text-gray-300 max-w-[100px] truncate", children: currentProfile.name })] }), open && (_jsxs("div", { role: "menu", "aria-label": "Profils", className: "absolute right-0 mt-2 w-56 bg-[#111118] border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden", children: [profiles.map((profile) => {
                        const isCurrent = profile.id === currentProfile.id;
                        const isSwitch = switching === profile.id;
                        return (_jsxs("button", { role: "menuitem", onClick: () => handleSelect(profile.id), disabled: isSwitch, className: `w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${isCurrent
                                ? 'text-white bg-white/10'
                                : 'text-gray-300 hover:text-white hover:bg-white/5'}`, children: [_jsx(ProfileAvatar, { avatarKey: profile.avatarKey, name: profile.name, size: 32, isActive: isCurrent, isKids: profile.isKids }), _jsx("span", { className: "flex-1 truncate", children: profile.name }), isCurrent && (_jsx("span", { className: "text-[#e50914] text-xs", children: "\u2713" })), isSwitch && (_jsx("span", { className: "w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" }))] }, profile.id));
                    }), _jsxs("div", { className: "border-t border-white/10 mt-1 pt-1", children: [_jsx("button", { role: "menuitem", onClick: () => { setOpen(false); navigate('/profiles'); }, className: "w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors", children: "G\u00E9rer les profils" }), _jsx("button", { role: "menuitem", onClick: handleLogout, className: "w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors", children: "Se d\u00E9connecter" })] })] }))] }));
}
//# sourceMappingURL=ProfileSwitcherPopover.js.map