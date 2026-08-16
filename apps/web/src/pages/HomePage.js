import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '../components/content/HeroSection.js';
import ShelfRow from '../components/content/ShelfRow.js';
import GenerateShelfDialog from '../components/content/GenerateShelfDialog.js';
import ArrivalCard from '../components/content/ArrivalCard.js';
import HorizontalRow from '../components/content/HorizontalRow.js';
import EmptyState from '../components/ui/EmptyState.js';
import Spinner from '../components/ui/Spinner.js';
import Button from '../components/ui/Button.js';
import { useMovies } from '../hooks/useMovies.js';
import { useHome } from '../hooks/useHome.js';
import { useArrivals } from '../hooks/useArrivals.js';
import { useOpenDetail } from '../hooks/useOpenDetail.js';
const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
export default function HomePage() {
    const navigate = useNavigate();
    const openDetail = useOpenDetail();
    const { data: movies, loading: moviesLoading } = useMovies({ pageSize: 1 });
    const { data: homeData, isLoading: homeLoading } = useHome(DEFAULT_PROFILE_ID);
    const { arrivals, refresh: refreshArrivals } = useArrivals('unread');
    const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
    const shelves = homeData?.shelves ?? [];
    const isLoading = moviesLoading || homeLoading;
    const hasContent = (movies?.items.length ?? 0) > 0 || shelves.length > 0;
    if (!isLoading && !hasContent) {
        return (_jsx(EmptyState, { icon: "\uD83D\uDCE1", heading: "Aucun contenu disponible", description: "Ajoutez une source IPTV pour commencer \u00E0 explorer votre catalogue.", action: _jsx(Button, { onClick: () => navigate('/sources'), children: "Ajouter une source" }) }));
    }
    const hero = movies?.items[0];
    const isColdStart = homeData?.coldStart === true && shelves.length === 0;
    return (_jsxs("div", { children: [hero && (_jsx(HeroSection, { title: hero.title, synopsis: hero.synopsis, backdropUrl: hero.backdropUrl, mediaId: hero.id, trailerKey: hero.trailerKey, availabilityStatus: hero.availabilityStatus, onPlay: hero.availabilityStatus === 'AVAILABLE'
                    ? () => navigate(`/player/movie/${hero.id}`)
                    : undefined, onDetails: () => openDetail('movie', hero.id), onAddToList: () => { } })), isLoading && _jsx(Spinner, {}), arrivals.length > 0 && (_jsx("div", { className: "px-8 mt-8", children: _jsx(HorizontalRow, { title: "Nouveaut\u00E9s disponibles", children: arrivals.map((arrival) => (_jsx(ArrivalCard, { arrival: arrival, onDismiss: refreshArrivals }, arrival.id))) }) })), !homeLoading && (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex justify-end px-4 py-2", children: _jsx(Button, { variant: "secondary", size: "sm", onClick: () => setGenerateDialogOpen(true), children: "+ Cr\u00E9er une s\u00E9lection" }) }), isColdStart && (_jsx("p", { className: "px-4 py-2 text-sm text-gray-400", children: "Commencez \u00E0 regarder des contenus pour recevoir des recommandations personnalis\u00E9es." })), shelves.map((shelf) => (_jsx(ShelfRow, { shelf: shelf }, shelf.id)))] })), _jsx(GenerateShelfDialog, { open: generateDialogOpen, onClose: () => setGenerateDialogOpen(false), onSuccess: () => { } })] }));
}
//# sourceMappingURL=HomePage.js.map