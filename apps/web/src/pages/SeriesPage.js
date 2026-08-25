import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Component, useEffect, useRef, useState } from 'react';
import HeroSection from '../components/content/HeroSection.js';
import GenreChips from '../components/content/GenreChips.js';
import HorizontalRow from '../components/content/HorizontalRow.js';
import PosterCard from '../components/content/PosterCard.js';
import ShelfRow from '../components/content/ShelfRow.js';
import Skeleton from '../components/ui/Skeleton.js';
import Spinner from '../components/ui/Spinner.js';
import { useInfiniteSeriesPage } from '../hooks/useSeriesPage.js';
import { useSeries } from '../hooks/useSeries.js';
import { useGenres } from '../hooks/useGenres.js';
import { useOpenDetail } from '../hooks/useOpenDetail.js';
import { useProfile } from '../context/ProfileContext.js';
class ShelfErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(_) {
        return { hasError: true };
    }
    componentDidCatch(_error, _info) { }
    render() {
        if (this.state.hasError)
            return null;
        return this.props.children;
    }
}
function ShelfSkeleton() {
    return (_jsxs("div", { className: "px-8 mt-6", children: [_jsx(Skeleton, { className: "w-48 h-5 mb-3" }), _jsx("div", { className: "flex gap-3", children: Array.from({ length: 6 }).map((_, i) => (_jsx(Skeleton, { className: "w-36 h-52 flex-shrink-0" }, i))) })] }));
}
function SeriesShelf({ title, sortBy, availability, upcoming, genreId, }) {
    const openDetail = useOpenDetail();
    const { data, loading } = useSeries({ pageSize: 20, sortBy, availability, upcoming, genreId });
    if (!loading && !data?.items.length)
        return null;
    return (_jsxs(HorizontalRow, { title: title, children: [loading && (_jsx(Skeleton, { className: "shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" })), data?.items.map((s) => (_jsx("div", { className: "shrink-0 w-28 md:w-32 lg:w-36", children: _jsx(PosterCard, { title: s.title, year: s.year, posterUrl: s.posterUrl, mediaId: s.id, onClick: () => openDetail('series', s.id) }) }, s.id)))] }));
}
function PersonalizedShelves() {
    const { currentProfile, profileVersion } = useProfile();
    const { allShelves, isLoading, isFetchingMore, hasMore, loadMore, } = useInfiniteSeriesPage(currentProfile?.id ?? '', profileVersion);
    const sentinelRef = useRef(null);
    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel || !hasMore)
            return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting)
                loadMore();
        }, { rootMargin: '400px' });
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore, loadMore]);
    return (_jsxs("section", { children: [isLoading && _jsx(Spinner, {}), isLoading && (_jsxs(_Fragment, { children: [_jsx(ShelfSkeleton, {}), _jsx(ShelfSkeleton, {}), _jsx(ShelfSkeleton, {})] })), !isLoading && allShelves.map((shelf) => (_jsx(ShelfErrorBoundary, { children: _jsx(ShelfRow, { shelf: shelf }) }, shelf.id))), isFetchingMore && (_jsxs(_Fragment, { children: [_jsx(ShelfSkeleton, {}), _jsx(ShelfSkeleton, {}), _jsx(ShelfSkeleton, {})] })), hasMore && !isFetchingMore && _jsx("div", { ref: sentinelRef, "aria-hidden": "true" }), !hasMore && allShelves.length > 0 && (_jsx("p", { className: "text-center text-sm text-gray-600 py-8", children: "\u2014 Fin des recommandations \u2014" }))] }));
}
export default function SeriesPage() {
    const openDetail = useOpenDetail();
    const [selectedGenreId, setSelectedGenreId] = useState(undefined);
    const [availabilityMode, setAvailabilityMode] = useState('all');
    const { genres } = useGenres();
    const { data: heroData } = useSeries({ pageSize: 1, sortBy: 'popularity' });
    const heroSeries = heroData?.items[0];
    const selectedGenreName = genres.find((g) => g.id === selectedGenreId)?.name;
    const avail = availabilityMode === 'available' ? 'AVAILABLE' : undefined;
    const browsingCatalog = selectedGenreId != null || availabilityMode === 'available';
    return (_jsxs("div", { className: "min-h-screen bg-[#0a0a0f]", children: [heroSeries && (_jsx(HeroSection, { title: heroSeries.title, synopsis: heroSeries.synopsis, backdropUrl: heroSeries.backdropUrl, mediaId: heroSeries.id, availabilityStatus: heroSeries.availabilityStatus, onDetails: () => openDetail('series', heroSeries.id) })), _jsxs("div", { className: "flex flex-wrap items-center gap-2 px-4 pt-4", children: [_jsx("button", { type: "button", onClick: () => setAvailabilityMode('all'), className: `px-3 py-1 rounded-full text-sm font-medium transition-colors ${availabilityMode === 'all'
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white hover:bg-white/20'}`, children: "Tout le catalogue" }), _jsx("button", { type: "button", onClick: () => setAvailabilityMode('available'), className: `px-3 py-1 rounded-full text-sm font-medium transition-colors ${availabilityMode === 'available'
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white hover:bg-white/20'}`, children: "Disponible maintenant" })] }), _jsx(GenreChips, { genres: genres, selected: selectedGenreId, onSelect: setSelectedGenreId }), browsingCatalog && (selectedGenreId ? (_jsx(SeriesShelf, { title: selectedGenreName ?? 'Séries', genreId: selectedGenreId, availability: avail })) : (_jsxs(_Fragment, { children: [_jsx(SeriesShelf, { title: "Disponibles", sortBy: "recentAvailability", availability: "AVAILABLE" }), _jsx(SeriesShelf, { title: "Populaires", sortBy: "popularity", availability: avail }), _jsx(SeriesShelf, { title: "Les mieux not\u00E9es", sortBy: "voteAverage", availability: avail }), _jsx(SeriesShelf, { title: "Sorties r\u00E9centes", sortBy: "year", availability: avail }), _jsx(SeriesShelf, { title: "\u00C0 venir", upcoming: true, availability: avail })] }))), _jsx(PersonalizedShelves, {})] }));
}
//# sourceMappingURL=SeriesPage.js.map