import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState, useCallback } from 'react';
function formatTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds))
        return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0)
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}
export default function PlayerControls({ videoRef, alternatives, onVariantSwitch, onClose }) {
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [buffering, setBuffering] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [visible, setVisible] = useState(true);
    const hideTimerRef = useRef(null);
    function resetHideTimer() {
        setVisible(true);
        if (hideTimerRef.current)
            clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setVisible(false), 3000);
    }
    useEffect(() => {
        resetHideTimer();
        return () => {
            if (hideTimerRef.current)
                clearTimeout(hideTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        const video = videoRef.current;
        if (!video)
            return;
        function onPlay() { setPlaying(true); }
        function onPause() { setPlaying(false); }
        function onTimeUpdate() { setCurrentTime(video.currentTime); }
        function onDurationChange() { setDuration(video.duration); }
        function onVolumeChange() {
            setVolume(video.volume);
            setMuted(video.muted);
        }
        function onWaiting() { setBuffering(true); }
        function onPlaying() { setBuffering(false); }
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('volumechange', onVolumeChange);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('playing', onPlaying);
        // Sync initial state
        setPlaying(!video.paused);
        setCurrentTime(video.currentTime);
        setDuration(video.duration);
        setVolume(video.volume);
        setMuted(video.muted);
        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('volumechange', onVolumeChange);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('playing', onPlaying);
        };
    }, [videoRef]);
    useEffect(() => {
        function onFsChange() {
            setIsFullscreen(!!document.fullscreenElement);
        }
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, []);
    function togglePlay() {
        const video = videoRef.current;
        if (!video)
            return;
        if (video.paused)
            video.play().catch(() => undefined);
        else
            video.pause();
    }
    function seek(value) {
        const video = videoRef.current;
        if (!video)
            return;
        video.currentTime = value;
    }
    function changeVolume(value) {
        const video = videoRef.current;
        if (!video)
            return;
        video.volume = value;
        video.muted = value === 0;
    }
    function toggleMute() {
        const video = videoRef.current;
        if (!video)
            return;
        video.muted = !video.muted;
    }
    const toggleFullscreen = useCallback(() => {
        const container = videoRef.current?.closest('.player-container') ?? document.documentElement;
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(() => undefined);
        }
        else {
            document.exitFullscreen().catch(() => undefined);
        }
    }, [videoRef]);
    const seekable = isFinite(duration) && duration > 0;
    return (_jsxs(_Fragment, { children: [buffering && (_jsx("div", { className: "absolute inset-0 flex items-center justify-center pointer-events-none", children: _jsx("span", { className: "w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin" }) })), _jsxs("div", { className: `absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`, onMouseMove: resetHideTimer, onClick: resetHideTimer, children: [_jsxs("div", { className: "flex items-center justify-between px-4 pt-4 bg-gradient-to-b from-black/70 to-transparent pb-8", children: [_jsx("button", { type: "button", "aria-label": "Fermer", onClick: onClose, className: "text-white text-sm font-medium px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors", children: "\u2190 Retour" }), alternatives.length > 0 && (_jsx("div", { className: "relative", children: _jsxs("select", { "aria-label": "Changer de version", onChange: (e) => onVariantSwitch(e.target.value), className: "bg-black/70 text-white text-xs rounded px-2 py-1 border border-white/20 cursor-pointer", defaultValue: "", children: [_jsx("option", { value: "", disabled: true, children: "Autre version" }), alternatives.map((v) => (_jsx("option", { value: v.id, children: [v.audioLanguage?.toUpperCase(), v.videoQuality].filter(Boolean).join(' · ') || 'Version alternative' }, v.id)))] }) }))] }), _jsx("div", { className: "flex-1 flex items-center justify-center cursor-pointer", onClick: togglePlay, children: !playing && !buffering && (_jsx("div", { className: "w-16 h-16 rounded-full bg-white/20 flex items-center justify-center", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-8 h-8 text-white ml-1", children: _jsx("path", { d: "M8 5v14l11-7z" }) }) })) }), _jsxs("div", { className: "px-4 pb-4 pt-8 bg-gradient-to-t from-black/70 to-transparent", children: [_jsx("div", { className: "mb-3", children: _jsx("input", { type: "range", "aria-label": "Position de lecture", min: 0, max: seekable ? duration : 0, step: 1, value: seekable ? currentTime : 0, disabled: !seekable, onChange: (e) => seek(Number(e.target.value)), className: "w-full h-1 accent-white cursor-pointer disabled:cursor-default disabled:opacity-50" }) }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { type: "button", "aria-label": playing ? 'Pause' : 'Lire', onClick: togglePlay, className: "text-white", children: playing ? (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-6 h-6", children: _jsx("path", { d: "M6 19h4V5H6v14zm8-14v14h4V5h-4z" }) })) : (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-6 h-6", children: _jsx("path", { d: "M8 5v14l11-7z" }) })) }), _jsx("button", { type: "button", "aria-label": muted ? 'Activer le son' : 'Couper le son', onClick: toggleMute, className: "text-white", children: muted || volume === 0 ? (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-5 h-5", children: _jsx("path", { d: "M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" }) })) : (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-5 h-5", children: _jsx("path", { d: "M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" }) })) }), _jsx("input", { type: "range", "aria-label": "Volume", min: 0, max: 1, step: 0.05, value: muted ? 0 : volume, onChange: (e) => changeVolume(Number(e.target.value)), className: "w-20 h-1 accent-white cursor-pointer" }), _jsxs("span", { className: "text-white text-xs font-mono ml-1", children: [formatTime(currentTime), seekable ? ` / ${formatTime(duration)}` : ''] }), _jsx("div", { className: "flex-1" }), _jsx("button", { type: "button", "aria-label": isFullscreen ? 'Quitter le plein écran' : 'Plein écran', onClick: toggleFullscreen, className: "text-white", children: isFullscreen ? (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-5 h-5", children: _jsx("path", { d: "M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" }) })) : (_jsx("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "w-5 h-5", children: _jsx("path", { d: "M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" }) })) })] })] })] })] }));
}
//# sourceMappingURL=PlayerControls.js.map