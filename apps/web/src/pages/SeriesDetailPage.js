import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getSeries, getProfile, fetchContinueWatching, ApiError } from '../lib/api.js';
import { useInteractionEvents } from '../hooks/useInteractionEvents.js';
import { useDevices } from '../hooks/useDevices.js';
import Badge from '../components/ui/Badge.js';
import Button from '../components/ui/Button.js';
import Skeleton from '../components/ui/Skeleton.js';
import ErrorState from '../components/ui/ErrorState.js';
import CastRow from '../components/detail/CastRow.js';
import MediaHero from '../components/detail/MediaHero.js';
import MediaMetadata from '../components/detail/MediaMetadata.js';
import MediaActions from '../components/detail/MediaActions.js';
import SeasonSelector from '../components/detail/SeasonSelector.js';
import SimilarTitlesShelf from '../components/detail/SimilarTitlesShelf.js';
import MediaDetailShell from '../components/detail/MediaDetailShell.js';
function DetailSkeleton() {
    return (_jsxs("div", { className: "bg-[#0a0a0f] min-h-screen", children: [_jsx(Skeleton, { className: "w-full rounded-none", style: { height: 'clamp(300px, 56.25vw, 70vh)' } }), _jsx("div", { className: "px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto", children: _jsxs("div", { className: "flex gap-6 items-start", children: [_jsx("div", { className: "hidden md:block flex-shrink-0 w-44 rounded-xl overflow-hidden", children: _jsx(Skeleton, { height: "264px" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx(Skeleton, { className: "w-64 h-10 mb-3" }), _jsxs("div", { className: "flex gap-2 mb-4", children: [_jsx(Skeleton, { className: "w-12 h-5" }), _jsx(Skeleton, { className: "w-24 h-5" }), _jsx(Skeleton, { className: "w-20 h-5" })] }), _jsx(Skeleton, { className: "w-full h-4 mb-2" }), _jsx(Skeleton, { className: "w-4/5 h-4 mb-6" })] })] }) })] }));
}
export default function SeriesDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { devices } = useDevices();
    const { emit: emitEvent } = useInteractionEvents();
    const [series, setSeries] = useState(null);
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [profileId, setProfileId] = useState(undefined);
    const [progressByEpisodeId, setProgressByEpisodeId] = useState({});
    useEffect(() => {
        getProfile()
            .then((p) => setProfileId(p.id))
            .catch(() => { });
    }, []);
    useEffect(() => {
        fetchContinueWatching()
            .then((items) => {
            const map = {};
            for (const item of items) {
                if (item.mediaType === 'EPISODE') {
                    map[item.mediaId] = item.progressSeconds * 1000;
                }
            }
            setProgressByEpisodeId(map);
        })
            .catch(() => { });
    }, []);
    useEffect(() => {
        if (!id)
            return;
        let cancelled = false;
        setLoading(true);
        setNotFound(false);
        setError(null);
        async function load(initial) {
            try {
                const s = await getSeries(id);
                if (cancelled)
                    return;
                setSeries(s);
                if (initial) {
                    setLoading(false);
                    emitEvent({ eventType: 'DETAIL_OPENED', mediaType: 'SERIES', mediaId: id, clientType: 'web' });
                }
                return s;
            }
            catch (err) {
                if (cancelled)
                    return;
                if (err instanceof ApiError && err.status === 404) {
                    setNotFound(true);
                }
                else {
                    setError(err);
                }
                if (initial)
                    setLoading(false);
                return null;
            }
        }
        void load(true).then(async (s) => {
            if (!s || s.seasons.length > 0)
                return;
            for (let i = 0; i < 15; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                if (cancelled)
                    return;
                const next = await load(false);
                if (next && next.seasons.length > 0)
                    return;
            }
        });
        return () => {
            cancelled = true;
        };
    }, [id]);
    if (loading)
        return modal(_jsx(DetailSkeleton, {}));
    if (notFound) {
        return modal(_jsxs("div", { className: "flex flex-col items-center justify-center h-64 gap-4", children: [_jsx("p", { className: "text-gray-300 text-lg", children: "Cette s\u00E9rie est introuvable." }), _jsx(Button, { variant: "ghost", onClick: handleClose, children: "\u2190 Retour" })] }));
    }
    if (error)
        return modal(_jsx(ErrorState, { message: error.message, onRetry: handleClose }));
    if (!series)
        return null;
    return modal(_jsxs("div", { className: "bg-[#0a0a0f] min-h-screen", children: [_jsx(MediaHero, { backdropUrl: series.backdropUrl, posterUrl: series.posterUrl, trailerKey: series.trailerKey, title: series.title }), _jsx("div", { className: "px-4 py-6 md:px-8 md:py-8 max-w-5xl mx-auto", children: _jsxs("div", { className: "flex gap-6 items-start", children: [series.posterUrl && (_jsx("div", { className: "hidden md:block flex-shrink-0 w-44 -mt-24 relative z-10 rounded-xl overflow-hidden border border-white/10 shadow-2xl", children: _jsx("img", { src: series.posterUrl, alt: series.title, className: "w-full" }) })), _jsxs("div", { className: "flex-1 min-w-0", children: [series.enrichmentStatus === 'unmatched' && (_jsx("div", { className: "mb-3", children: _jsx(Badge, { variant: "unavailable", children: "Donn\u00E9es manquantes" }) })), series.enrichmentStatus === 'partial' && (_jsx("div", { className: "mb-3", children: _jsx(Badge, { variant: "default", children: "Donn\u00E9es partielles" }) })), _jsx(MediaMetadata, { title: series.title, originalTitle: series.originalTitle, year: series.year, genres: series.genres, certification: series.certification, voteAverage: series.voteAverage, synopsis: series.synopsis, seasonCount: series.seasonCount, status: series.status }), _jsx(MediaActions, { mediaType: "SERIES", mediaId: series.id, availabilityStatus: series.availabilityStatus }), _jsx(CastRow, { cast: series.cast, director: series.director }), _jsxs("div", { className: "mt-6", children: [_jsx("h2", { className: "text-lg font-semibold text-white mb-3", children: "Saisons" }), _jsx(SeasonSelector, { seriesId: series.id, seasons: series.seasons, profileId: profileId, devices: devices, progressByEpisodeId: progressByEpisodeId }, series.id)] })] })] }) }), _jsx(SimilarTitlesShelf, { mediaType: "SERIES", mediaId: series.id })] }));
}
//# sourceMappingURL=SeriesDetailPage.js.map