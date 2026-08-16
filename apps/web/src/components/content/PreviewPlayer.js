import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
export default function PreviewPlayer({ trailerKey, active, muted = true }) {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    const iframeRef = useRef(null);
    useEffect(() => {
        setLoaded(false);
        setFailed(false);
    }, [trailerKey]);
    useEffect(() => {
        if (!active || !iframeRef.current?.contentWindow)
            return;
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: muted ? 'mute' : 'unMute', args: '' }), '*');
    }, [muted, active, loaded]);
    if (!active)
        return null;
    const src = `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${trailerKey}&enablejsapi=1`;
    return (_jsx("iframe", { ref: iframeRef, src: src, tabIndex: -1, allow: "autoplay; encrypted-media", title: "Preview", "data-testid": "preview-iframe", className: "absolute inset-0 w-full h-full border-0 transition-opacity duration-500", style: {
            opacity: loaded && !failed ? 1 : 0,
            visibility: failed ? 'hidden' : 'visible',
        }, onLoad: () => setLoaded(true), onError: () => setFailed(true) }, trailerKey));
}
//# sourceMappingURL=PreviewPlayer.js.map