import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { getProfile } from '../lib/api.js';
export const PreviewContext = createContext({
    activeId: null,
    activeKey: null,
    activate: () => { },
    deactivate: () => { },
});
export function PreviewProvider({ children }) {
    const [activeId, setActiveId] = useState(null);
    const [activeKey, setActiveKey] = useState(null);
    const [autoplayEnabled, setAutoplayEnabled] = useState(true);
    const [reducedMotion, setReducedMotion] = useState(typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false);
    useEffect(() => {
        if (typeof window.matchMedia !== 'function')
            return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = (e) => setReducedMotion(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);
    useEffect(() => {
        getProfile()
            .then((p) => setAutoplayEnabled(p.preferences.autoplayPreviews ?? true))
            .catch(() => { });
    }, []);
    // Use refs so activate/deactivate are stable across renders
    const reducedMotionRef = useRef(reducedMotion);
    const autoplayEnabledRef = useRef(autoplayEnabled);
    reducedMotionRef.current = reducedMotion;
    autoplayEnabledRef.current = autoplayEnabled;
    const activate = useCallback((id, key) => {
        if (reducedMotionRef.current || !autoplayEnabledRef.current)
            return;
        setActiveId(id);
        setActiveKey(key);
    }, []);
    const deactivate = useCallback(() => {
        setActiveId(null);
        setActiveKey(null);
    }, []);
    return (_jsx(PreviewContext.Provider, { value: { activeId, activeKey, activate, deactivate }, children: children }));
}
export function usePreview() {
    return useContext(PreviewContext);
}
//# sourceMappingURL=PreviewContext.js.map