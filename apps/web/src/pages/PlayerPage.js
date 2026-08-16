import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { usePlayback } from '../hooks/usePlayback.js';
import { useProgressSync } from '../hooks/useProgressSync.js';
import Button from '../components/ui/Button.js';
import ErrorState from '../components/ui/ErrorState.js';
export default function PlayerPage() {
    const { mediaType, mediaId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);
    const initialAvailabilityId = searchParams.get('availabilityId') ?? undefined;
    const resolvedMediaType = mediaType === 'movie' ? 'movie' : 'episode';
    const { streamUrl, startPositionSeconds, alternatives, status, error, switchVariant } = usePlayback(resolvedMediaType, mediaId, initialAvailabilityId);
    const progressMediaType = mediaType === 'movie' ? 'MOVIE' : 'EPISODE';
    useProgressSync(videoRef, progressMediaType, mediaId, status === 'ready');
    // Load stream into video element when URL is ready
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !streamUrl)
            return;
        let hlsInstance = null;
        let cancelled = false;
        if (streamUrl.includes('.m3u8')) {
            import('hls.js').then(({ default: Hls }) => {
                if (cancelled)
                    return;
                if (Hls.isSupported()) {
                    hlsInstance = new Hls();
                    hlsInstance.loadSource(streamUrl);
                    hlsInstance.attachMedia(video);
                }
                else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    video.src = streamUrl;
                }
            }).catch(() => {
                if (!cancelled && video)
                    video.src = streamUrl;
            });
        }
        else {
            video.src = streamUrl;
        }
        return () => {
            cancelled = true;
            hlsInstance?.destroy();
            video.src = '';
        };
    }, [streamUrl]);
    // Set resume position on metadata ready
    useEffect(() => {
        const video = videoRef.current;
        if (!video)
            return;
        function onMetadata() {
            if (video && startPositionSeconds > 0) {
                video.currentTime = startPositionSeconds;
            }
        }
        video.addEventListener('loadedmetadata', onMetadata);
        return () => video.removeEventListener('loadedmetadata', onMetadata);
    }, [startPositionSeconds]);
    function handleBack() {
        videoRef.current?.pause();
        navigate(-1);
    }
    if (status === 'error') {
        return (_jsx("div", { className: "fixed inset-0 bg-black flex items-center justify-center", children: _jsx(ErrorState, { message: error ?? 'Impossible de lancer la lecture.', onRetry: () => navigate(-1) }) }));
    }
    return (_jsxs("div", { className: "fixed inset-0 bg-black flex flex-col", children: [_jsx("div", { className: "absolute top-4 left-4 z-10", children: _jsx(Button, { variant: "ghost", size: "sm", onClick: handleBack, children: "\u2190 Retour" }) }), status === 'loading' && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none", children: _jsx("span", { className: "w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" }) })), _jsx("video", { ref: videoRef, className: "w-full h-full object-contain", controls: true, autoPlay: true, playsInline: true }), alternatives.length > 0 && (_jsxs("div", { className: "absolute bottom-20 right-4 z-10 bg-black/80 rounded-lg p-3 max-w-xs", children: [_jsx("p", { className: "text-xs text-gray-400 mb-2 uppercase tracking-wide", children: "Autres versions" }), _jsx("div", { className: "flex flex-col gap-1", children: alternatives.map((v) => (_jsx("button", { type: "button", onClick: () => switchVariant(v.id), className: "text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-white/10 text-left transition-colors", children: [v.audioLanguage?.toUpperCase(), v.videoQuality]
                                .filter(Boolean)
                                .join(' · ') || 'Version alternative' }, v.id))) })] }))] }));
}
//# sourceMappingURL=PlayerPage.js.map