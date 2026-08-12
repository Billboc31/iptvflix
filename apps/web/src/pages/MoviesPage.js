import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FilterBar from '../components/content/FilterBar.js';
import PosterGrid from '../components/content/PosterGrid.js';
import Skeleton from '../components/ui/Skeleton.js';
import EmptyState from '../components/ui/EmptyState.js';
import ErrorState from '../components/ui/ErrorState.js';
import { useMovies } from '../hooks/useMovies.js';
import { useGenres } from '../hooks/useGenres.js';
export default function MoviesPage() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState({ page: 1, pageSize: 20 });
    const { data, loading, error, refetch } = useMovies(filters);
    const { genres } = useGenres();
    const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;
    const currentPage = filters.page ?? 1;
    return (_jsxs("div", { className: "px-8 py-6", children: [_jsx("h1", { className: "text-3xl font-bold text-white mb-6", children: "Films" }), _jsx(FilterBar, { value: filters, onChange: (f) => setFilters(f), showQuality: true, genres: genres }), loading && (_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4", children: Array.from({ length: 10 }).map((_, i) => (_jsx(Skeleton, { className: "aspect-[2/3] w-full rounded-lg" }, i))) })), !loading && error && _jsx(ErrorState, { message: error.message, onRetry: refetch }), !loading && !error && data && data.items.length === 0 && (_jsx(EmptyState, { icon: "\uD83C\uDFAC", heading: "Aucun film trouv\u00E9", description: "Essayez d'autres filtres ou ajoutez une source IPTV." })), !loading && !error && data && data.items.length > 0 && (_jsx(PosterGrid, { items: data.items, onItemClick: (id) => navigate(`/movies/${id}`) })), !loading && !error && data && totalPages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 mt-6", children: [_jsx("button", { onClick: () => setFilters((f) => ({ ...f, page: currentPage - 1 })), disabled: currentPage <= 1, className: "px-4 py-2 rounded-lg bg-[#1a1a24] border border-white/10 text-sm text-white disabled:opacity-40 hover:border-[#e50914]/50 transition-colors", children: "Pr\u00E9c\u00E9dent" }), _jsxs("span", { className: "text-sm text-gray-400", children: ["Page ", currentPage, " / ", totalPages] }), _jsx("button", { onClick: () => setFilters((f) => ({ ...f, page: currentPage + 1 })), disabled: currentPage >= totalPages, className: "px-4 py-2 rounded-lg bg-[#1a1a24] border border-white/10 text-sm text-white disabled:opacity-40 hover:border-[#e50914]/50 transition-colors", children: "Suivant" })] }))] }));
}
//# sourceMappingURL=MoviesPage.js.map