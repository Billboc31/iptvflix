import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getMovie, ApiError } from '../lib/api.js';
import Badge from '../components/ui/Badge.js';
import Button from '../components/ui/Button.js';
import Skeleton from '../components/ui/Skeleton.js';
import ErrorState from '../components/ui/ErrorState.js';
import WatchlistButton from '../components/content/WatchlistButton.js';
import FeedbackButtons from '../components/content/FeedbackButtons.js';
import TrailerPlayer from '../components/detail/TrailerPlayer.js';
import CastRow from '../components/detail/CastRow.js';
function DetailSkeleton() {
    return (_jsxs("div", { children: [_jsx("div", { className: "relative h-[50vh] min-h-72 overflow-hidden", children: _jsx(Skeleton, { className: "absolute inset-0 w-full h-full rounded-none" }) }), _jsx("div", { className: "px-8 py-6 -mt-24 relative", children: _jsxs("div", { className: "flex gap-6 items-start", children: [_jsx("div", { className: "hidden md:block flex-shrink-0 w-40 rounded-xl overflow-hidden", children: _jsx(Skeleton, { height: "240px" }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx(Skeleton, { className: "w-64 h-10 mb-3" }), _jsxs("div", { className: "flex gap-2 mb-4", children: [_jsx(Skeleton, { className: "w-12 h-5" }), _jsx(Skeleton, { className: "w-16 h-5" }), _jsx(Skeleton, { className: "w-20 h-5" })] }), _jsxs("div", { className: "flex gap-2 mb-4", children: [_jsx(Skeleton, { className: "w-16 h-5" }), _jsx(Skeleton, { className: "w-20 h-5" })] }), _jsx(Skeleton, { className: "w-full h-4 mb-2" }), _jsx(Skeleton, { className: "w-4/5 h-4 mb-2" }), _jsx(Skeleton, { className: "w-3/5 h-4 mb-6" })] })] }) })] }));
}
function VariantBadge({ variant }) {
    const parts = [];
    if (variant.audioLanguage)
        parts.push(variant.audioLanguage.toUpperCase());
    if (variant.subtitleLanguage)
        parts.push(`sub:${variant.subtitleLanguage}`);
    if (variant.videoQuality)
        parts.push(variant.videoQuality);
    return (_jsx("span", { className: `inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${variant.status === 'AVAILABLE'
            ? 'border-white/20 text-gray-300'
            : 'border-white/10 text-gray-600 line-through'}`, children: parts.length > 0 ? parts.join(' · ') : 'Inconnu' }));
}
export default function MovieDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [movie, setMovie] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notFound, setNotFound] = useState(false);
    const [selectedVariantId, setSelectedVariantId] = useState(null);
    useEffect(() => {
        if (!id)
            return;
        setLoading(true);
        setNotFound(false);
        setError(null);
        getMovie(id)
            .then((m) => {
            setMovie(m);
            setSelectedVariantId(m.selectedVariantId);
        })
            .catch((err) => {
            if (err instanceof ApiError && err.status === 404) {
                setNotFound(true);
            }
            else {
                setError(err);
            }
        })
            .finally(() => setLoading(false));
    }, [id]);
    if (loading)
        return _jsx(DetailSkeleton, {});
    if (notFound) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-64 gap-4", children: [_jsx("p", { className: "text-gray-300 text-lg", children: "Ce film est introuvable." }), _jsx(Button, { variant: "ghost", onClick: () => navigate(-1), children: "\u2190 Retour" })] }));
    }
    if (error)
        return _jsx(ErrorState, { message: error.message, onRetry: () => navigate(-1) });
    if (!movie)
        return null;
    const showOriginalTitle = movie.originalTitle && movie.originalTitle !== movie.title;
    return (_jsxs("div", { children: [_jsxs("div", { className: "relative h-[50vh] min-h-72 overflow-hidden", children: [movie.backdropUrl ? (_jsx("img", { src: movie.backdropUrl, alt: "", "aria-hidden": "true", className: "absolute inset-0 w-full h-full object-cover" })) : (_jsx("div", { className: "absolute inset-0 bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f]" })), _jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/40 to-transparent" })] }), _jsx("div", { className: "px-8 py-6 -mt-24 relative", children: _jsxs("div", { className: "flex gap-6 items-start", children: [movie.posterUrl && (_jsx("div", { className: "hidden md:block flex-shrink-0 w-40 rounded-xl overflow-hidden border border-white/10 shadow-2xl", children: _jsx("img", { src: movie.posterUrl, alt: movie.title, className: "w-full" }) })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("h1", { className: "text-4xl font-bold text-white mb-1", children: movie.title }), showOriginalTitle && (_jsx("p", { className: "text-gray-400 text-base mb-3", children: movie.originalTitle })), _jsxs("div", { className: "flex flex-wrap items-center gap-2 mb-4", children: [movie.year && (_jsx("span", { className: "text-gray-400 text-sm", children: movie.year })), movie.runtime && (_jsxs("span", { className: "text-gray-400 text-sm", children: [movie.runtime, " min"] })), movie.certification && (_jsx(Badge, { variant: "default", children: movie.certification })), movie.voteAverage !== null && (_jsxs("span", { className: "text-yellow-400 text-sm font-medium", children: ["\u2605 ", movie.voteAverage.toFixed(1)] })), movie.quality && _jsx(Badge, { variant: "quality", children: movie.quality }), _jsx(Badge, { variant: movie.availabilityStatus === 'AVAILABLE' ? 'available' : 'unavailable', children: movie.availabilityStatus === 'AVAILABLE' ? 'Disponible' : 'Indisponible' }), movie.enrichmentStatus === 'unmatched' && (_jsx(Badge, { variant: "unavailable", children: "Donn\u00E9es manquantes" })), movie.enrichmentStatus === 'partial' && (_jsx(Badge, { variant: "default", children: "Donn\u00E9es partielles" }))] }), movie.genres.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2 mb-4", children: movie.genres.map((g) => (_jsx(Badge, { variant: "info", children: g }, g))) })), movie.synopsis && (_jsx("p", { className: "text-gray-300 text-sm leading-relaxed mb-6 max-w-2xl", children: movie.synopsis })), _jsx(TrailerPlayer, { trailerKey: movie.trailerKey, title: movie.title }), movie.variants.length > 0 && (_jsxs("div", { className: "mb-6", children: [_jsx("p", { className: "text-xs font-medium text-gray-400 uppercase tracking-wide mb-2", children: "Version disponible" }), _jsx("div", { className: "flex flex-wrap gap-2", children: movie.variants.map((v) => (_jsx("button", { type: "button", onClick: () => v.status === 'AVAILABLE' && setSelectedVariantId(v.id), className: `cursor-pointer transition-opacity ${v.status !== 'AVAILABLE' ? 'opacity-40 cursor-not-allowed' : ''} ${selectedVariantId === v.id
                                                    ? 'ring-2 ring-[#e50914] rounded'
                                                    : ''}`, children: _jsx(VariantBadge, { variant: v }) }, v.id))) })] })), _jsx(CastRow, { cast: movie.cast, director: movie.director }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(Button, { variant: "ghost", onClick: () => navigate(-1), children: "\u2190 Retour" }), _jsx(WatchlistButton, { mediaType: "MOVIE", mediaId: movie.id }), _jsx(FeedbackButtons, { mediaType: "MOVIE", mediaId: movie.id })] })] })] }) })] }));
}
//# sourceMappingURL=MovieDetailPage.js.map