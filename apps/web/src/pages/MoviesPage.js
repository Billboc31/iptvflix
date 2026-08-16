import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '../components/content/HeroSection.js';
import GenreChips from '../components/content/GenreChips.js';
import HorizontalRow from '../components/content/HorizontalRow.js';
import PosterCard from '../components/content/PosterCard.js';
import Skeleton from '../components/ui/Skeleton.js';
import { useMovies } from '../hooks/useMovies.js';
import { useGenres } from '../hooks/useGenres.js';
import { useOpenDetail } from '../hooks/useOpenDetail.js';
function MovieShelf({ title, sortBy, availability, upcoming, genreId, }) {
    const openDetail = useOpenDetail();
    const { data, loading } = useMovies({ pageSize: 20, sortBy, availability, upcoming, genreId });
    if (!loading && (!data?.items.length))
        return null;
    return (_jsxs(HorizontalRow, { title: title, children: [loading && (_jsx(Skeleton, { className: "shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" })), data?.items.map((movie) => (_jsx("div", { className: "shrink-0 w-28 md:w-32 lg:w-36", children: _jsx(PosterCard, { title: movie.title, year: movie.year, posterUrl: movie.posterUrl, quality: movie.quality, badge: movie.availabilityStatus === 'UNAVAILABLE'
                        ? { label: 'Indisponible', variant: 'unavailable' }
                        : undefined, mediaId: movie.id, trailerKey: movie.trailerKey, onClick: () => openDetail('movie', movie.id) }) }, movie.id)))] }));
}
export default function MoviesPage() {
    const navigate = useNavigate();
    const openDetail = useOpenDetail();
    const [selectedGenreId, setSelectedGenreId] = useState(undefined);
    const [availabilityMode, setAvailabilityMode] = useState('all');
    const { genres } = useGenres();
    const { data: heroData } = useMovies({ pageSize: 1, sortBy: 'popularity' });
    const heroMovie = heroData?.items[0];
    const selectedGenreName = genres.find((g) => g.id === selectedGenreId)?.name;
    const avail = availabilityMode === 'available' ? 'AVAILABLE' : undefined;
    return (_jsxs("div", { className: "min-h-screen bg-[#0a0a0f]", children: [heroMovie && (_jsx(HeroSection, { title: heroMovie.title, synopsis: heroMovie.synopsis, backdropUrl: heroMovie.backdropUrl, mediaId: heroMovie.id, trailerKey: heroMovie.trailerKey, availabilityStatus: heroMovie.availabilityStatus, onPlay: heroMovie.availabilityStatus === 'AVAILABLE'
                    ? () => navigate(`/player/movie/${heroMovie.id}`)
                    : undefined, onDetails: () => openDetail('movie', heroMovie.id) })), _jsxs("div", { className: "flex flex-wrap items-center gap-2 px-4 pt-4", children: [_jsx("button", { onClick: () => setAvailabilityMode('all'), className: `px-3 py-1 rounded-full text-sm font-medium transition-colors ${availabilityMode === 'all'
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white hover:bg-white/20'}`, children: "Tout le catalogue" }), _jsx("button", { onClick: () => setAvailabilityMode('available'), className: `px-3 py-1 rounded-full text-sm font-medium transition-colors ${availabilityMode === 'available'
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white hover:bg-white/20'}`, children: "Disponible maintenant" })] }), _jsx(GenreChips, { genres: genres, selected: selectedGenreId, onSelect: setSelectedGenreId }), selectedGenreId ? (_jsx(MovieShelf, { title: selectedGenreName ?? 'Films', genreId: selectedGenreId, availability: avail })) : (_jsxs(_Fragment, { children: [availabilityMode === 'available' && (_jsx(MovieShelf, { title: "Disponibles", sortBy: "recentAvailability", availability: "AVAILABLE" })), _jsx(MovieShelf, { title: "Populaires", sortBy: "popularity", availability: avail }), _jsx(MovieShelf, { title: "Les mieux not\u00E9s", sortBy: "voteAverage", availability: avail }), _jsx(MovieShelf, { title: "Sorties r\u00E9centes", sortBy: "year", availability: avail }), _jsx(MovieShelf, { title: "\u00C0 venir", upcoming: true, availability: avail })] }))] }));
}
//# sourceMappingURL=MoviesPage.js.map