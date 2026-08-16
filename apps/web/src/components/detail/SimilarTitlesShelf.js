import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSimilarMovies, getSimilarSeries } from '../../lib/api.js';
import HorizontalRow from '../content/HorizontalRow.js';
import PosterCard from '../content/PosterCard.js';
import Skeleton from '../ui/Skeleton.js';
export default function SimilarTitlesShelf({ mediaType, mediaId }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    useEffect(() => {
        let stale = false;
        setLoading(true);
        setError(false);
        const fetchPromise = mediaType === 'MOVIE'
            ? getSimilarMovies(mediaId).then((r) => r.map((m) => ({ ...m, _kind: 'MOVIE' })))
            : getSimilarSeries(mediaId).then((r) => r.map((s) => ({ ...s, _kind: 'SERIES' })));
        fetchPromise
            .then((data) => { if (!stale)
            setItems(data); })
            .catch(() => { if (!stale)
            setError(true); })
            .finally(() => { if (!stale)
            setLoading(false); });
        return () => { stale = true; };
    }, [mediaType, mediaId]);
    if (loading) {
        return (_jsxs("section", { className: "mb-8 px-4 md:px-8", children: [_jsx("h2", { className: "text-lg font-semibold text-white mb-3 px-1", children: "Titres similaires" }), _jsx("div", { className: "flex gap-3", children: Array.from({ length: 5 }).map((_, i) => (_jsxs("div", { className: "flex-shrink-0 w-32", children: [_jsx(Skeleton, { className: "aspect-[2/3] rounded-lg w-full" }), _jsx(Skeleton, { className: "h-3 w-20 mt-1" })] }, i))) })] }));
    }
    if (error || items.length === 0)
        return null;
    const modalState = location.state;
    const modalBackground = modalState?.background;
    const modalScrollY = modalState?.scrollY;
    function openSimilar(kind, id) {
        const route = kind === 'MOVIE' ? `/movies/${id}` : `/series/${id}`;
        if (modalBackground) {
            // Inside modal: replace current entry, preserving original background so × exits to browsing context
            navigate(route, { state: { background: modalBackground, scrollY: modalScrollY }, replace: true });
        }
        else {
            // Direct page view: open as new modal with current page as background
            navigate(route, { state: { background: location, scrollY: window.scrollY } });
        }
    }
    return (_jsx(HorizontalRow, { title: "Titres similaires", children: items.map((item) => {
            const badge = item.availabilityStatus === 'UNAVAILABLE'
                ? { label: 'Indisponible', variant: 'unavailable' }
                : undefined;
            const quality = item._kind === 'MOVIE' ? item.quality : undefined;
            return (_jsx("div", { className: "flex-shrink-0 w-32 snap-start", children: _jsx(PosterCard, { title: item.title, year: item.year, posterUrl: item.posterUrl, quality: quality ?? null, badge: badge, onClick: () => openSimilar(item._kind, item.id) }) }, item.id));
        }) }));
}
//# sourceMappingURL=SimilarTitlesShelf.js.map