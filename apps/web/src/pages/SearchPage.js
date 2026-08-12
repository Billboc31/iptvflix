import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchContent, materializeMovie, materializeSeries } from '../lib/api.js';
import PosterCard from '../components/content/PosterCard.js';
import Spinner from '../components/ui/Spinner.js';
import EmptyState from '../components/ui/EmptyState.js';
import ErrorState from '../components/ui/ErrorState.js';
import { useDebounce } from '../hooks/useDebounce.js';
export default function SearchPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const initial = searchParams.get('q') ?? '';
    const [query, setQuery] = useState(initial);
    const debouncedQuery = useDebounce(query, 300);
    const [movies, setMovies] = useState([]);
    const [series, setSeries] = useState([]);
    const [externalMovies, setExternalMovies] = useState([]);
    const [externalSeries, setExternalSeries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [externalError, setExternalError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    useEffect(() => {
        if (!debouncedQuery.trim()) {
            setMovies([]);
            setSeries([]);
            setExternalMovies([]);
            setExternalSeries([]);
            setError(null);
            setExternalError(null);
            return;
        }
        setLoading(true);
        setError(null);
        searchContent(debouncedQuery)
            .then(({ movies: m, series: s, externalMovies: em = [], externalSeries: es = [] }) => {
            setMovies(m);
            setSeries(s);
            setExternalMovies(em);
            setExternalSeries(es);
        })
            .catch((err) => {
            setError(err);
            setMovies([]);
            setSeries([]);
            setExternalMovies([]);
            setExternalSeries([]);
        })
            .finally(() => setLoading(false));
    }, [debouncedQuery, retryCount]);
    // Sync query into URL
    useEffect(() => {
        if (query.trim())
            setSearchParams({ q: query });
        else
            setSearchParams({});
    }, [query, setSearchParams]);
    const total = movies.length + series.length;
    const hasExternal = externalMovies.length > 0 || externalSeries.length > 0;
    const showExternal = hasExternal && total <= 5;
    async function handleExternalMovieClick(candidate) {
        setExternalError(null);
        try {
            const { id } = await materializeMovie(candidate.tmdbId);
            navigate(`/movies/${id}`);
        }
        catch {
            setExternalError("Impossible d'ouvrir ce titre. Veuillez réessayer.");
        }
    }
    async function handleExternalSeriesClick(candidate) {
        setExternalError(null);
        try {
            const { id } = await materializeSeries(candidate.tmdbId);
            navigate(`/series/${id}`);
        }
        catch {
            setExternalError("Impossible d'ouvrir ce titre. Veuillez réessayer.");
        }
    }
    function externalMovieBadge(candidate) {
        if (candidate.releaseStatus && candidate.releaseStatus !== 'Released') {
            return { label: 'À venir', variant: 'upcoming' };
        }
        return { label: 'Non disponible', variant: 'unavailable' };
    }
    function externalSeriesBadge(candidate) {
        if (candidate.releaseStatus && candidate.releaseStatus !== 'Released') {
            return { label: 'À venir', variant: 'upcoming' };
        }
        return { label: 'Non disponible', variant: 'unavailable' };
    }
    return (_jsxs("div", { className: "px-8 py-6", children: [_jsx("h1", { className: "text-3xl font-bold text-white mb-6", children: "Recherche" }), _jsxs("div", { className: "flex items-center gap-3 mb-8 max-w-lg", children: [_jsx("span", { className: "text-gray-500", children: "\uD83D\uDD0D" }), _jsx("input", { type: "search", value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Rechercher films, s\u00E9ries\u2026", autoFocus: true, className: "flex-1 bg-[#1a1a24] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#e50914]/50 text-sm" })] }), loading && _jsx(Spinner, {}), !loading && error && (_jsx(ErrorState, { message: "Une erreur est survenue lors de la recherche.", onRetry: () => {
                    setError(null);
                    setRetryCount((c) => c + 1);
                } })), !loading && !error && query.trim() && total === 0 && !showExternal && (_jsx(EmptyState, { icon: "\uD83D\uDD0E", heading: "Aucun r\u00E9sultat", description: `Aucun contenu trouvé pour « ${query} ».` })), !loading && !error && movies.length > 0 && (_jsxs("section", { className: "mb-8", children: [_jsxs("h2", { className: "text-lg font-semibold text-white mb-4", children: ["Films ", _jsxs("span", { className: "text-gray-500 text-sm", children: ["(", movies.length, ")"] })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4", children: movies.map((m) => (_jsx(PosterCard, { title: m.title, year: m.year, posterUrl: m.posterUrl, quality: m.quality, onClick: () => navigate(`/movies/${m.id}`) }, m.id))) })] })), !loading && !error && series.length > 0 && (_jsxs("section", { className: "mb-8", children: [_jsxs("h2", { className: "text-lg font-semibold text-white mb-4", children: ["S\u00E9ries ", _jsxs("span", { className: "text-gray-500 text-sm", children: ["(", series.length, ")"] })] }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4", children: series.map((s) => (_jsx(PosterCard, { title: s.title, year: s.year, posterUrl: s.posterUrl, onClick: () => navigate(`/series/${s.id}`) }, s.id))) })] })), !loading && !error && showExternal && (_jsxs("section", { children: [_jsx("h2", { className: "text-lg font-semibold text-gray-400 mb-1", children: "Aussi trouv\u00E9 en dehors de votre catalogue" }), _jsx("p", { className: "text-xs text-gray-600 mb-4", children: "Ces titres ne sont pas disponibles dans vos sources configur\u00E9es." }), externalError && (_jsx("p", { role: "alert", className: "text-red-400 text-sm mb-4", children: externalError })), externalMovies.length > 0 && (_jsxs("div", { className: "mb-6", children: [_jsx("h3", { className: "text-sm font-medium text-gray-500 mb-3", children: "Films" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4", children: externalMovies.map((m) => (_jsx(PosterCard, { title: m.title, year: m.year, posterUrl: m.posterUrl, badge: externalMovieBadge(m), onClick: () => handleExternalMovieClick(m) }, m.tmdbId))) })] })), externalSeries.length > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-500 mb-3", children: "S\u00E9ries" }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4", children: externalSeries.map((s) => (_jsx(PosterCard, { title: s.title, year: s.year, posterUrl: s.posterUrl, badge: externalSeriesBadge(s), onClick: () => handleExternalSeriesClick(s) }, s.tmdbId))) })] }))] }))] }));
}
//# sourceMappingURL=SearchPage.js.map