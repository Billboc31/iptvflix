import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState, useCallback } from 'react';
import { formatTime } from '../../lib/format-time.js';
import { getLanguageName } from '../../lib/language-names.js';
import { formatVariantLabel } from '../../lib/variant-label.js';
import { usePlayerKeyboard } from '../../hooks/usePlayerKeyboard.js';
const NEAR_END_THRESHOLD_S = 90;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
export default function PlayerControls({ videoRef, alternatives, onVariantSwitch, onClose, currentVariantId, audioTracks = [], currentAudioTrack = 0, onAudioTrack, subtitleTracks = [], currentSubtitleTrack = null, onSubtitleTrack, episodeLabel, nextEpisode, onNextEpisode, markers = [], deliveryMode, containerExtension, hintDurationSeconds = null, onStableDuration, }) {
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [stableDuration, setStableDuration] = useState(null);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [buffering, setBuffering] = useState(false);
    const [seeking, setSeeking] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isPiP, setIsPiP] = useState(false);
    const [visible, setVisible] = useState(true);
    const [openPopover, setOpenPopover] = useState(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [bufferedFraction, setBufferedFraction] = useState(0);
    const hideTimerRef = useRef(null);
    const playingRef = useRef(false);
    const scrubbingRef = useRef(false);
    const popoverOpenRef = useRef(false);
    // Tracks whether the stable duration has been locked (hint or first valid durationchange)
    const stableDurationSetRef = useRef(false);
    // Always-current ref for use inside event handler closures
    const stableDurationRef = useRef(null);
    stableDurationRef.current = stableDuration;
    // Sync refs with state for use in callbacks without closure staleness
    playingRef.current = playing;
    popoverOpenRef.current = openPopover !== null;
    function clearHideTimer() {
        if (hideTimerRef.current) {
            clearTimeout(hideTimerRef.current);
            hideTimerRef.current = null;
        }
    }
    function startHideTimer() {
        clearHideTimer();
        if (!playingRef.current || scrubbingRef.current || popoverOpenRef.current)
            return;
        hideTimerRef.current = setTimeout(() => {
            if (playingRef.current && !scrubbingRef.current && !popoverOpenRef.current) {
                setVisible(false);
            }
        }, 3000);
    }
    function showControls() {
        setVisible(true);
        startHideTimer();
    }
    const showControlsRef = useRef(showControls);
    showControlsRef.current = showControls;
    // Apply probe-based hint: lock stable duration before first durationchange fires
    useEffect(() => {
        if (hintDurationSeconds != null && hintDurationSeconds > 0 && !stableDurationSetRef.current) {
            stableDurationSetRef.current = true;
            setStableDuration(hintDurationSeconds);
            onStableDuration?.(hintDurationSeconds);
        }
    }, [hintDurationSeconds, onStableDuration]);
    // Cancel hide timer when popover opens; restart when it closes
    useEffect(() => {
        if (openPopover !== null) {
            clearHideTimer();
        }
        else {
            startHideTimer();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [openPopover]);
    useEffect(() => {
        showControls();
        return clearHideTimer;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // Video element event bindings
    useEffect(() => {
        const video = videoRef.current;
        if (!video)
            return;
        function onPlay() {
            setPlaying(true);
            playingRef.current = true;
            startHideTimer();
        }
        function onPause() {
            setPlaying(false);
            playingRef.current = false;
            clearHideTimer();
            setVisible(true);
        }
        function onTimeUpdate() { setCurrentTime(video.currentTime); }
        function onDurationChange() {
            const d = video.duration;
            if (!isFinite(d) || d <= 0)
                return;
            const current = stableDurationRef.current ?? 0;
            // IPTV/HLS often reports a fragment duration first. Allow the known
            // duration to grow, never shrink — a 10s lock would mark the title complete.
            if (d <= current + 0.5)
                return;
            setStableDuration(d);
            onStableDuration?.(d);
            stableDurationSetRef.current = true;
        }
        function onVolumeChange() {
            setVolume(video.volume);
            setMuted(video.muted);
        }
        function onWaiting() { setBuffering(true); }
        function onPlaying() {
            setBuffering(false);
            setSeeking(false);
        }
        function onSeeking() { setSeeking(true); }
        function onSeeked() { setSeeking(false); }
        function onRateChange() { setPlaybackRate(video.playbackRate); }
        function onProgress() {
            const buf = video.buffered;
            const dur = stableDurationRef.current;
            if (buf.length > 0 && dur !== null && dur > 0) {
                setBufferedFraction(buf.end(buf.length - 1) / dur);
            }
        }
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('volumechange', onVolumeChange);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        video.addEventListener('seeking', onSeeking);
        video.addEventListener('seeked', onSeeked);
        video.addEventListener('ratechange', onRateChange);
        video.addEventListener('progress', onProgress);
        // Sync initial state
        setPlaying(!video.paused);
        playingRef.current = !video.paused;
        setCurrentTime(video.currentTime);
        setVolume(video.volume);
        setMuted(video.muted);
        setPlaybackRate(video.playbackRate);
        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('volumechange', onVolumeChange);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
            video.removeEventListener('seeking', onSeeking);
            video.removeEventListener('seeked', onSeeked);
            video.removeEventListener('ratechange', onRateChange);
            video.removeEventListener('progress', onProgress);
            clearHideTimer();
            scrubbingRef.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoRef]);
    // Fullscreen state sync (standard + iOS Safari)
    useEffect(() => {
        function onFsChange() {
            setIsFullscreen(!!document.fullscreenElement);
            showControlsRef.current();
        }
        function onWebkitFsBegin() { setIsFullscreen(true); showControlsRef.current(); }
        function onWebkitFsEnd() { setIsFullscreen(false); showControlsRef.current(); }
        document.addEventListener('fullscreenchange', onFsChange);
        const video = videoRef.current;
        if (video) {
            video.addEventListener('webkitbeginfullscreen', onWebkitFsBegin);
            video.addEventListener('webkitendfullscreen', onWebkitFsEnd);
        }
        return () => {
            document.removeEventListener('fullscreenchange', onFsChange);
            if (video) {
                video.removeEventListener('webkitbeginfullscreen', onWebkitFsBegin);
                video.removeEventListener('webkitendfullscreen', onWebkitFsEnd);
            }
        };
    }, [videoRef]);
    // Picture-in-Picture state sync
    useEffect(() => {
        function onEnterPiP() { setIsPiP(true); }
        function onLeavePiP() { setIsPiP(false); }
        const video = videoRef.current;
        if (!video)
            return;
        video.addEventListener('enterpictureinpicture', onEnterPiP);
        video.addEventListener('leavepictureinpicture', onLeavePiP);
        return () => {
            video.removeEventListener('enterpictureinpicture', onEnterPiP);
            video.removeEventListener('leavepictureinpicture', onLeavePiP);
        };
    }, [videoRef]);
    const togglePlay = useCallback(() => {
        const video = videoRef.current;
        if (!video)
            return;
        if (video.paused)
            video.play().catch(() => undefined);
        else
            video.pause();
    }, [videoRef]);
    const seek = useCallback((value) => {
        const video = videoRef.current;
        if (!video)
            return;
        video.currentTime = value;
    }, [videoRef]);
    function skip(delta) {
        const video = videoRef.current;
        if (!video)
            return;
        const dur = stableDurationRef.current ?? (isFinite(video.duration) ? video.duration : 0);
        video.currentTime = Math.max(0, Math.min(dur, video.currentTime + delta));
    }
    function changeVolume(value) {
        const video = videoRef.current;
        if (!video)
            return;
        video.volume = value;
        video.muted = value === 0;
    }
    const toggleMute = useCallback(() => {
        const video = videoRef.current;
        if (!video)
            return;
        video.muted = !video.muted;
    }, [videoRef]);
    const toggleFullscreen = useCallback(() => {
        const video = videoRef.current;
        if (!video)
            return;
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => undefined);
            return;
        }
        const container = video.closest('.player-container') ?? document.documentElement;
        if (container.requestFullscreen) {
            container.requestFullscreen().catch(() => undefined);
        }
        else if (video.webkitSupportsFullscreen && video.webkitEnterFullscreen) {
            // iOS Safari fallback
            video.webkitEnterFullscreen();
        }
    }, [videoRef]);
    function togglePiP() {
        const video = videoRef.current;
        if (!video)
            return;
        if (document.pictureInPictureElement) {
            document.exitPictureInPicture().catch(() => undefined);
        }
        else {
            video.requestPictureInPicture().catch(() => undefined);
        }
    }
    function setSpeed(rate) {
        const video = videoRef.current;
        if (!video)
            return;
        video.playbackRate = rate;
        setOpenPopover(null);
    }
    function handleSeekPointerDown() {
        scrubbingRef.current = true;
        clearHideTimer();
    }
    function handleSeekPointerUp() {
        scrubbingRef.current = false;
        startHideTimer();
    }
    usePlayerKeyboard(videoRef, { togglePlay, seek, toggleMute, toggleFullscreen });
    const seekable = stableDuration !== null && stableDuration > 0;
    // Active marker at current time
    const activeMarker = markers.find((m) => currentTime >= m.startSeconds && currentTime < m.endSeconds) ?? null;
    // Near-end overlay for next episode
    const showNextEpisodeCard = nextEpisode != null &&
        stableDuration !== null &&
        stableDuration > 0 &&
        currentTime >= stableDuration - NEAR_END_THRESHOLD_S;
    // PiP support detection
    const pipSupported = typeof document !== 'undefined' &&
        'pictureInPictureEnabled' in document &&
        document.pictureInPictureEnabled;
    // Show volume slider only on non-touch / desktop: hide on mobile where system controls volume
    // We detect via pointer coarse media query (CSS), but for rendering use a safe default of true
    // and hide via CSS class if needed
    const isMobileUA = typeof navigator !== 'undefined' &&
        /android|iphone|ipad|ipod/i.test(navigator.userAgent);
    function markerLabel(type) {
        if (type === 'intro')
            return 'Passer l\'intro';
        if (type === 'recap')
            return 'Passer le récap';
        return 'Épisode suivant';
    }
    function togglePopover(name) {
        setOpenPopover((prev) => (prev === name ? null : name));
    }
    return (_jsxs("div", { className: "absolute inset-0", onPointerMove: showControls, onClick: () => {
            if (openPopover !== null) {
                setOpenPopover(null);
                return;
            }
            showControls();
        }, children: [(buffering || seeking) && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none", children: _jsx("span", { className: "w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin" }) })), activeMarker && (_jsx("div", { className: "absolute bottom-28 right-6 pointer-events-auto", children: _jsx("button", { type: "button", onClick: () => seek(activeMarker.endSeconds), className: "px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-sm font-medium rounded border border-white/40 backdrop-blur-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: markerLabel(activeMarker.type) }) })), showNextEpisodeCard && !activeMarker && (_jsx("div", { className: "absolute bottom-28 right-6 pointer-events-auto", children: _jsx("button", { type: "button", onClick: onNextEpisode, className: "px-4 py-2 bg-[#e50914] hover:bg-[#e50914]/80 text-white text-sm font-medium rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: "\u00C9pisode suivant \u2192" }) })), _jsxs("div", { "data-testid": "controls-overlay", className: `absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, children: [_jsxs("div", { className: "flex items-center justify-between px-4 pt-4 pb-8 bg-gradient-to-b from-black/70 to-transparent", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "button", "aria-label": "Fermer", onClick: (e) => { e.stopPropagation(); onClose(); }, className: "text-white text-sm font-medium px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white min-h-[44px]", children: "\u2190 Retour" }), episodeLabel && (_jsx("span", { className: "text-white/80 text-sm font-medium truncate max-w-xs", children: episodeLabel }))] }), nextEpisode && (_jsx("button", { type: "button", onClick: (e) => { e.stopPropagation(); onNextEpisode?.(); }, className: "text-white text-sm font-medium px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white min-h-[44px]", children: "\u00C9pisode suivant \u2192" }))] }), _jsx("div", { className: "flex-1 flex items-center justify-center cursor-pointer", onClick: (e) => { e.stopPropagation(); togglePlay(); }, children: !playing && !buffering && !seeking && (_jsx("div", { className: "w-16 h-16 rounded-full bg-white/20 flex items-center justify-center pointer-events-none", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-8 h-8 text-white ml-1", "aria-hidden": "true", children: _jsx("path", { d: "M8 5v14l11-7z" }) }) })) }), _jsxs("div", { className: "px-4 pt-8 bg-gradient-to-t from-black/70 to-transparent", style: { paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }, onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-center gap-8 mb-4", children: [_jsx("button", { type: "button", "aria-label": "Reculer de 10 secondes", onClick: () => skip(-10), className: "text-white opacity-90 hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-7 h-7", children: [_jsx("path", { d: "M12.5 3a9 9 0 1 0 7.94 4.77L18.8 9.4A7 7 0 1 1 12.5 5V3z" }), _jsx("path", { d: "M11 3l3.5 3.5L11 10V3z" }), _jsx("text", { x: "8.5", y: "15.5", fontSize: "5", fontWeight: "bold", fill: "currentColor", fontFamily: "sans-serif", children: "10" })] }) }), _jsx("button", { type: "button", "aria-label": playing ? 'Pause' : 'Lire', "aria-pressed": playing, onClick: togglePlay, className: "text-white min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: playing ? (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-8 h-8", children: _jsx("path", { d: "M6 19h4V5H6v14zm8-14v14h4V5h-4z" }) })) : (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-8 h-8", children: _jsx("path", { d: "M8 5v14l11-7z" }) })) }), _jsx("button", { type: "button", "aria-label": "Avancer de 10 secondes", onClick: () => skip(10), className: "text-white opacity-90 hover:opacity-100 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-7 h-7", children: [_jsx("path", { d: "M11.5 3a9 9 0 1 1-7.94 4.77L5.2 9.4A7 7 0 1 0 11.5 5V3z" }), _jsx("path", { d: "M13 3l-3.5 3.5L13 10V3z" }), _jsx("text", { x: "8.5", y: "15.5", fontSize: "5", fontWeight: "bold", fill: "currentColor", fontFamily: "sans-serif", children: "10" })] }) })] }), _jsxs("div", { className: `mb-2 relative h-5 flex items-center${seekable ? '' : ' opacity-50'}`, children: [_jsx("div", { className: "absolute inset-x-0 h-1 bg-white/20 rounded pointer-events-none", "aria-hidden": "true", children: seekable && stableDuration !== null && (_jsxs(_Fragment, { children: [_jsx("div", { className: "absolute inset-y-0 left-0 bg-white/40 rounded", style: { width: `${(bufferedFraction * 100).toFixed(1)}%` } }), _jsx("div", { className: "absolute inset-y-0 left-0 bg-white rounded", style: { width: `${((currentTime / stableDuration) * 100).toFixed(1)}%` } })] })) }), seekable && stableDuration !== null && (_jsx("div", { className: "absolute top-1/2 w-3 h-3 bg-white rounded-full -translate-y-1/2 pointer-events-none", style: { left: `calc(${((currentTime / stableDuration) * 100).toFixed(1)}% - 6px)` }, "aria-hidden": "true" })), _jsx("input", { type: "range", "aria-label": "Position de lecture", min: 0, max: seekable && stableDuration !== null ? stableDuration : 0, step: 1, value: seekable && stableDuration !== null ? currentTime : 0, disabled: !seekable, onPointerDown: handleSeekPointerDown, onPointerUp: handleSeekPointerUp, onChange: (e) => seek(Number(e.target.value)), style: { touchAction: 'none' }, className: "absolute inset-0 w-full opacity-0 cursor-pointer disabled:cursor-default" })] }), _jsx("div", { className: "text-white text-xs font-mono mb-3", children: stableDuration !== null
                                    ? `${formatTime(currentTime)} / ${formatTime(stableDuration)}`
                                    : '--:-- / --:--' }), _jsxs("div", { className: "flex items-center gap-2 flex-wrap", children: [_jsx("button", { type: "button", "aria-label": muted ? 'Activer le son' : 'Couper le son', "aria-pressed": muted, onClick: toggleMute, className: "text-white min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: muted || volume === 0 ? (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-5 h-5", children: _jsx("path", { d: "M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" }) })) : (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-5 h-5", children: _jsx("path", { d: "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" }) })) }), !isMobileUA && (_jsx("input", { type: "range", "aria-label": "Volume", min: 0, max: 1, step: 0.05, value: muted ? 0 : volume, onPointerDown: handleSeekPointerDown, onPointerUp: handleSeekPointerUp, onChange: (e) => changeVolume(Number(e.target.value)), className: "w-20 h-1 accent-white cursor-pointer" })), _jsx("div", { className: "flex-1" }), audioTracks.length > 1 && (_jsxs("div", { className: "relative", children: [_jsx("button", { type: "button", "aria-label": "Piste audio", "aria-expanded": openPopover === 'audio', "aria-haspopup": "menu", onClick: () => togglePopover('audio'), className: "text-white text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: "Audio" }), openPopover === 'audio' && (_jsx("div", { role: "menu", "aria-label": "S\u00E9lection de la piste audio", className: "absolute bottom-12 right-0 bg-black/90 rounded border border-white/10 min-w-[160px] py-1 z-50", children: audioTracks.map((track) => (_jsxs("button", { type: "button", role: "menuitem", onClick: () => { onAudioTrack?.(track.id); setOpenPopover(null); }, className: "w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: [_jsx("span", { className: "w-4 text-center", children: currentAudioTrack === track.id ? '✓' : '' }), track.label || getLanguageName(track.lang)] }, track.id))) }))] })), (subtitleTracks.length > 0 || (deliveryMode === 'DIRECT' && /mkv|avi|ts/i.test(containerExtension ?? ''))) && (_jsxs("div", { className: "relative", children: [_jsx("button", { type: "button", "aria-label": "Sous-titres", "aria-expanded": openPopover === 'subtitle', "aria-haspopup": "menu", onClick: () => togglePopover('subtitle'), className: `text-xs px-2 py-1 rounded transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white ${currentSubtitleTrack !== null ? 'text-white bg-white/20' : 'text-white bg-white/10 hover:bg-white/20'}`, children: "CC" }), openPopover === 'subtitle' && (_jsxs("div", { role: "menu", "aria-label": "S\u00E9lection des sous-titres", className: "absolute bottom-12 right-0 bg-black/90 rounded border border-white/10 min-w-[180px] py-1 z-50", children: [_jsxs("button", { type: "button", role: "menuitem", onClick: () => { onSubtitleTrack?.(null); setOpenPopover(null); }, className: "w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: [_jsx("span", { className: "w-4 text-center", children: currentSubtitleTrack === null ? '✓' : '' }), "D\u00E9sactiv\u00E9s"] }), subtitleTracks.length === 0 && deliveryMode === 'DIRECT' && (_jsx("div", { className: "px-4 py-2 text-sm text-white/50", children: "Sous-titres non disponibles" })), subtitleTracks.map((track) => (_jsxs("button", { type: "button", role: "menuitem", onClick: () => { onSubtitleTrack?.(track.id); setOpenPopover(null); }, className: "w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: [_jsx("span", { className: "w-4 text-center", children: currentSubtitleTrack === track.id ? '✓' : '' }), track.label || getLanguageName(track.lang)] }, track.id)))] }))] })), _jsxs("div", { className: "relative", children: [_jsxs("button", { type: "button", "aria-label": `Vitesse: ${playbackRate}×`, "aria-expanded": openPopover === 'speed', "aria-haspopup": "menu", onClick: () => togglePopover('speed'), className: "text-white text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: [playbackRate, "\u00D7"] }), openPopover === 'speed' && (_jsx("div", { role: "menu", "aria-label": "Vitesse de lecture", className: "absolute bottom-12 right-0 bg-black/90 rounded border border-white/10 min-w-[100px] py-1 z-50", children: SPEEDS.map((rate) => (_jsxs("button", { type: "button", role: "menuitem", onClick: () => setSpeed(rate), className: "w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: [_jsx("span", { className: "w-4 text-center", children: playbackRate === rate ? '✓' : '' }), rate, "\u00D7"] }, rate))) }))] }), alternatives.length > 0 && (_jsxs("div", { className: "relative", children: [_jsx("button", { type: "button", "aria-label": "Qualit\u00E9", "aria-expanded": openPopover === 'quality', "aria-haspopup": "menu", onClick: () => togglePopover('quality'), className: "text-white text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors min-h-[44px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: "Qualit\u00E9" }), openPopover === 'quality' && (_jsx("div", { role: "menu", "aria-label": "S\u00E9lection de la qualit\u00E9", className: "absolute bottom-12 right-0 bg-black/90 rounded border border-white/10 min-w-[180px] py-1 z-50", children: alternatives.map((v) => (_jsxs("button", { type: "button", role: "menuitem", onClick: () => { onVariantSwitch(v.id); setOpenPopover(null); }, className: "w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: [_jsx("span", { className: "w-4 text-center", children: currentVariantId === v.id ? '✓' : '' }), formatVariantLabel(v, alternatives)] }, v.id))) }))] })), pipSupported && (_jsx("button", { type: "button", "aria-label": isPiP ? 'Quitter le mode image dans l\'image' : 'Image dans l\'image', "aria-pressed": isPiP, onClick: togglePiP, className: "text-white min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-5 h-5", children: _jsx("path", { d: "M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3C1.9 3 1 3.88 1 4.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z" }) }) })), _jsx("button", { type: "button", "aria-label": isFullscreen ? 'Quitter le plein écran' : 'Plein écran', "aria-pressed": isFullscreen, onClick: toggleFullscreen, className: "text-white min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-white", children: isFullscreen ? (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-5 h-5", children: _jsx("path", { d: "M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" }) })) : (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-5 h-5", children: _jsx("path", { d: "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" }) })) })] })] })] }), _jsx("style", { children: `
        video::cue {
          background-color: rgba(0, 0, 0, 0.75);
          color: #ffffff;
          font-size: 1rem;
          line-height: 1.4;
          padding: 0.1em 0.3em;
          border-radius: 2px;
        }
      ` })] }));
}
//# sourceMappingURL=PlayerControls.js.map