import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '../components/content/HeroSection.js';
import GenreChips from '../components/content/GenreChips.js';
import HorizontalRow from '../components/content/HorizontalRow.js';
import PosterCard from '../components/content/PosterCard.js';
import Skeleton from '../components/ui/Skeleton.js';
import { useSeries } from '../hooks/useSeries.js';
import { useGenres } from '../hooks/useGenres.js';
import { useOpenDetail } from '../hooks/useOpenDetail.js';
function SeriesShelf({ title, sortBy, availability, upcoming, genreId, }) {
    const openDetail = useOpenDetail();
    const { data, loading } = useSeries({ pageSize: 20, sortBy, availability, upcoming, genreId });
    if (!loading && (!data?.items.length))
        return null;
    return (_jsxs(HorizontalRow, { title: title, children: [loading && (_jsx(Skeleton, { className: "shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" })), data?.items.map((s) => (_jsx("div", { className: "shrink-0 w-28 md:w-32 lg:w-36", children: _jsx(PosterCard, { title: s.title, year: s.year, posterUrl: s.posterUrl, badge: s.availabilityStatus === 'UNAVAILABLE'
                        ? { label: 'Indisponible', variant: 'unavailable' }
                        : undefined, mediaId: s.id, onClick: () => openDetail('series', s.id) }) }, s.id)))] }));
}
export default function SeriesPage() {
    const navigate = useNavigate();
    const openDetail = useOpenDetail();
    const [selectedGenreId, setSelectedGenreId] = useState(undefined);
    const [availabilityMode, setAvailabilityMode] = useState('all');
    const { genres } = useGenres();
    const { data: heroData } = useSeries({ pageSize: 1, sortBy: 'popularity' });
    const heroSeries = heroData?.items[0];
    const selectedGenreName = genres.find((g) => g.id === selectedGenreId)?.name;
    const avail = availabilityMode === 'available' ? 'AVAILABLE' : undefined;
    return (_jsxs("div", { className: "min-h-screen bg-[#0a0a0f]", children: [heroSeries && (_jsx(HeroSection, { title: heroSeries.title, synopsis: heroSeries.synopsis, backdropUrl: heroSeries.backdropUrl, mediaId: heroSeries.id, availabilityStatus: heroSeries.availabilityStatus, onDetails: () => openDetail('series', heroSeries.id) })), _jsxs("div", { className: "flex flex-wrap items-center gap-2 px-4 pt-4", children: [_jsx("button", { onClick: () => setAvailabilityMode('all'), className: `px-3 py-1 rounded-full text-sm font-medium transition-colors ${availabilityMode === 'all'
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white hover:bg-white/20'}`, children: "Tout le catalogue" }), _jsx("button", { onClick: () => setAvailabilityMode('available'), className: `px-3 py-1 rounded-full text-sm font-medium transition-colors ${availabilityMode === 'available'
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white hover:bg-white/20'}`, children: "Disponible maintenant" })] }), _jsx(GenreChips, { genres: genres, selected: selectedGenreId, onSelect: setSelectedGenreId }), selectedGenreId ? (_jsx(SeriesShelf, { title: selectedGenreName ?? 'Séries', genreId: selectedGenreId, availability: avail })) : (_jsxs(_Fragment, { children: [availabilityMode === 'available' && (_jsx(SeriesShelf, { title: "Disponibles", sortBy: "recentAvailability", availability: "AVAILABLE" })), _jsx(SeriesShelf, { title: "Populaires", sortBy: "popularity", availability: avail }), _jsx(SeriesShelf, { title: "Les mieux not\u00E9es", sortBy: "voteAverage", availability: avail }), _jsx(SeriesShelf, { title: "Sorties r\u00E9centes", sortBy: "year", availability: avail }), _jsx(SeriesShelf, { title: "\u00C0 venir", upcoming: true, availability: avail })] }))] }));
}
//# sourceMappingURL=SeriesPage.js.map