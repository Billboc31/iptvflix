import { useEffect, useState } from 'react';
import { getEpisodeSegments, getProfile, updateProfilePreferences } from '../lib/api.js';
export function useEpisodeSegments(episodeId, durationSeconds, sourceKey) {
    const [state, setState] = useState({ key: '', segments: [] });
    const key = `${episodeId}:${sourceKey}:${durationSeconds}`;
    useEffect(() => {
        if (!episodeId)
            return;
        let cancelled = false;
        getEpisodeSegments(episodeId, durationSeconds ?? undefined).then((response) => {
            if (!cancelled)
                setState({ key, segments: response.segments });
        }).catch(() => { if (!cancelled)
            setState({ key, segments: [] }); });
        return () => { cancelled = true; };
    }, [episodeId, key, durationSeconds]);
    return state.key === key ? state.segments : [];
}
export function usePlaybackPreferences(episodeId) {
    const [preferences, setPreferences] = useState({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!episodeId)
            return;
        let cancelled = false;
        getProfile().then((p) => { if (!cancelled)
            setPreferences(p.preferences); }).catch(() => undefined);
        return () => { cancelled = true; };
    }, [episodeId]);
    async function toggleNeverStop() {
        setSaving(true);
        setError(null);
        try {
            const result = await updateProfilePreferences({ neverStopMode: !preferences.neverStopMode });
            setPreferences(result.preferences);
        }
        catch {
            setError('Impossible d’enregistrer le mode Never Stop.');
        }
        finally {
            setSaving(false);
        }
    }
    return { preferences, toggleNeverStop, saving, preferenceError: error };
}
//# sourceMappingURL=useEpisodeSegments.js.map