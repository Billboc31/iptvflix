import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getMovie, fetchContinueWatching, ApiError } from '../lib/api.js';
import { useInteractionEvents } from '../hooks/useInteractionEvents.js';
import { useDevices } from '../hooks/useDevices.js';
import { useToast } from '../components/ui/Toast.js';
import Badge from '../components/ui/Badge.js';
import Button from '../components/ui/Button.js';
import Skeleton from '../components/ui/Skeleton.js';
import ErrorState from '../components/ui/ErrorState.js';
import CastRow from '../components/detail/CastRow.js';
import DevicePickerModal from '../components/devices/DevicePickerModal.js';
import MediaHero from '../components/detail/MediaHero.js';
import MediaMetadata from '../components/detail/MediaMetadata.js';
import MediaActions from '../components/detail/MediaActions.js';
import AvailabilityPanel from '../components/detail/AvailabilityPanel.js';
import SimilarTitlesShelf from '../components/detail/SimilarTitlesShelf.js';
import MediaDetailShell from '../components/detail/MediaDetailShell.js';
function DetailSkeleton() {
    return (_jsxs("div", { className: "bg-[#0a0a0f] min-h-screen", children: [_jsx(Skeleton, { className: "w-full rounded-none", style: { height: 'clamp(300px, 56.25vw, 70vh)' } }), _jsx("div", { className: "px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto", children: _jsxs("div", { className: "flex gap-6 items-start", children: [_jsx("div", { className: "hidden md:block flex-shrink-0 w-44 rounded-xl overflow-hidden", children: _jsx(Skeleton, { height: "264px" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx(Skeleton, { className: "w-64 h-10 mb-3" }), _jsxs("div", { className: "flex gap-2 mb-4", children: [_jsx(Skeleton, { className: "w-12 h-5" }), _jsx(Skeleton, { className: "w-16 h-5" }), _jsx(Skeleton, { className: "w-20 h-5" })] }), _jsx(Skeleton, { className: "w-full h-4 mb-2" }), _jsx(Skeleton, { className: "w-4/5 h-4 mb-2" }), _jsx(Skeleton, { className: "w-3/5 h-4 mb-6" })] })] }) })] }));
}
export default function MovieDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();
    const { devices } = useDevices();
    const { emit: emitEvent } = useInteractionEvents();
    const [movie, setMovie] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [progressMs, setProgressMs] = useState(0);
    const modalState = location.state;
    const isModal = !!modalState?.background;
    const savedScrollY = modalState?.scrollY;
    function handleClose() {
        navigate(-1);
    }
    function modal(content) {
        if (!isModal)
            return content;
        return (_jsx(MediaDetailShell, { onClose: handleClose, scrollY: savedScrollY, children: content }));
    }
    useEffect(() => {
        if (!id)
            return;
        let cancelled = false;
        setLoading(true);
        setNotFound(false);
        setError(null);
        async function loadMovie() {
            const m = await getMovie(id);
            if (cancelled)
                return m;
            setMovie(m);
            setSelectedVariantId(m.selectedVariantId);
            emitEvent({ eventType: 'DETAIL_OPENED', mediaType: 'MOVIE', mediaId: id, clientType: 'web' });
            return m;
        }
        Promise.allSettled([loadMovie(), fetchContinueWatching()])
            .then(async ([movieResult, cwResult]) => {
            if (cancelled)
                return;
            if (movieResult.status === 'rejected') {
                const err = movieResult.reason;
                if (err instanceof ApiError && err.status === 404) {
                    setNotFound(true);
                }
                else {
                    setError(err);
                }
                setLoading(false);
                return;
            }
            if (cwResult.status === 'fulfilled') {
                const item = cwResult.value.find((i) => i.mediaType === 'MOVIE' && i.mediaId === id);
                setProgressMs(item ? item.progressSeconds * 1000 : 0);
            }
            setLoading(false);
            const first = movieResult.value;
            if (!first || first.trailerKey || (first.cast?.length ?? 0) > 0 || !first.tmdbId)
                return;
            for (let i = 0; i < 12; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                if (cancelled)
                    return;
                try {
                    const next = await getMovie(id);
                    if (cancelled)
                        return;
                    setMovie(next);
                    setSelectedVariantId(next.selectedVariantId);
                    if (next.trailerKey || (next.cast?.length ?? 0) > 0)
                        return;
                }
                catch {
                    return;
                }
            }
        })
            .catch(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [id]);
    if (loading)
        return modal(_jsx(DetailSkeleton, {}));
    if (notFound) {
        return modal(_jsxs("div", { className: "flex flex-col items-center justify-center h-64 gap-4", children: [_jsx("p", { className: "text-gray-300 text-lg", children: "Ce film est introuvable." }), _jsx(Button, { variant: "ghost", onClick: handleClose, children: "\u2190 Retour" })] }));
    }
    if (error)
        return modal(_jsx(ErrorState, { message: error.message, onRetry: handleClose }));
    if (!movie)
        return null;
    const playRoute = `/player/movie/${movie.id}${selectedVariantId ? `?availabilityId=${selectedVariantId}` : ''}`;
    return modal(_jsxs("div", { className: "bg-[#0a0a0f] min-h-screen", children: [_jsx(MediaHero, { backdropUrl: movie.backdropUrl, posterUrl: movie.posterUrl, trailerKey: movie.trailerKey, title: movie.title }), _jsx("div", { className: "px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto", children: _jsxs("div", { className: "flex gap-6 items-start", children: [movie.posterUrl && (_jsx("div", { className: "hidden md:block flex-shrink-0 w-44 -mt-24 relative z-10 rounded-xl overflow-hidden border border-white/10 shadow-2xl", children: _jsx("img", { src: movie.posterUrl, alt: movie.title, className: "w-full" }) })), _jsxs("div", { className: "flex-1 min-w-0", children: [movie.enrichmentStatus === 'unmatched' && (_jsx("div", { className: "mb-3", children: _jsx(Badge, { variant: "unavailable", children: "Donn\u00E9es manquantes" }) })), movie.enrichmentStatus === 'partial' && (_jsx("div", { className: "mb-3", children: _jsx(Badge, { variant: "default", children: "Donn\u00E9es partielles" }) })), _jsx(MediaMetadata, { title: movie.title, originalTitle: movie.originalTitle, year: movie.year, runtime: movie.runtime, genres: movie.genres, certification: movie.certification, voteAverage: movie.voteAverage, synopsis: movie.synopsis }), _jsx(MediaActions, { mediaType: "MOVIE", mediaId: movie.id, availabilityStatus: movie.availabilityStatus, playRoute: playRoute, playLabel: progressMs > 30_000 ? 'Reprendre' : 'Lecture', onPlayOnTv: () => setPickerOpen(true), showPlayOnTv: devices.length > 0 }), _jsx(AvailabilityPanel, { variants: movie.variants, selectedVariantId: selectedVariantId, onSelectVariant: setSelectedVariantId }), _jsx(CastRow, { cast: movie.cast, director: movie.director })] })] }) }), _jsx(SimilarTitlesShelf, { mediaType: "MOVIE", mediaId: movie.id }), _jsx(DevicePickerModal, { open: pickerOpen, onClose: () => setPickerOpen(false), devices: devices, mediaType: "movie", mediaId: movie.id, availabilityId: selectedVariantId, progressMs: progressMs, onFastPath: (name, state) => {
                    if (state === 'delivered') {
                        toast.show(`Lecture lancée sur ${name}`, 'success');
                    }
                    else if (state === 'device-offline') {
                        toast.show(`${name} est hors ligne`, 'error');
                    }
                    else {
                        toast.show('Erreur lors de l\'envoi de la commande', 'error');
                    }
                } })] }));
}
//# sourceMappingURL=MovieDetailPage.js.map