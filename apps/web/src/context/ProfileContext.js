import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { listProfiles, selectProfile as apiSelectProfile } from '../lib/api.js';
const LAST_PROFILE_KEY = 'iptvflix_last_profile_id';
const ProfileContext = createContext(null);
export function ProfileProvider({ children }) {
    const [profiles, setProfiles] = useState([]);
    const [currentProfile, setCurrentProfile] = useState(null);
    const [profileVersion, setProfileVersion] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const initialized = useRef(false);
    const refreshProfiles = useCallback(async () => {
        const list = await listProfiles();
        setProfiles(list);
    }, []);
    useEffect(() => {
        if (initialized.current)
            return;
        initialized.current = true;
        async function init() {
            try {
                const list = await listProfiles();
                setProfiles(list);
                const lastId = localStorage.getItem(LAST_PROFILE_KEY);
                const last = lastId ? list.find((p) => p.id === lastId) : null;
                if (last) {
                    const { profile } = await apiSelectProfile(last.id);
                    setCurrentProfile(profile);
                    setProfileVersion((v) => v + 1);
                }
            }
            catch {
                // leave currentProfile null — ProfileRequiredRoute redirects to /profiles/choose
            }
            finally {
                setIsLoading(false);
            }
        }
        init();
    }, []);
    const selectProfile = useCallback(async (profileId) => {
        const { profile } = await apiSelectProfile(profileId);
        localStorage.setItem(LAST_PROFILE_KEY, profileId);
        setCurrentProfile(profile);
        setProfileVersion((v) => v + 1);
        // refresh list to pick up updated lastUsedAt ordering
        listProfiles().then(setProfiles).catch(() => { });
    }, []);
    return (_jsx(ProfileContext.Provider, { value: { currentProfile, profiles, profileVersion, isLoading, selectProfile, refreshProfiles }, children: children }));
}
export function useProfile() {
    const ctx = useContext(ProfileContext);
    if (!ctx)
        throw new Error('useProfile must be used inside ProfileProvider');
    return ctx;
}
export function clearLastProfileId() {
    try {
        localStorage.removeItem(LAST_PROFILE_KEY);
    }
    catch {
        // ignore
    }
}
//# sourceMappingURL=ProfileContext.js.map