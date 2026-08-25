import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Component, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import HeroSection from '../components/content/HeroSection.js';
import ShelfRow from '../components/content/ShelfRow.js';
import GenerateShelfDialog from '../components/content/GenerateShelfDialog.js';
import ContinueWatchingRow from '../components/content/ContinueWatchingRow.js';
import ArrivalCard from '../components/content/ArrivalCard.js';
import HorizontalRow from '../components/content/HorizontalRow.js';
import EmptyState from '../components/ui/EmptyState.js';
import ErrorState from '../components/ui/ErrorState.js';
import Skeleton from '../components/ui/Skeleton.js';
import Spinner from '../components/ui/Spinner.js';
import Button from '../components/ui/Button.js';
import { useInfiniteHome } from '../hooks/useHome.js';
import { useArrivals } from '../hooks/useArrivals.js';
import { useOpenDetail } from '../hooks/useOpenDetail.js';
import { useProfile } from '../context/ProfileContext.js';
import { useInteractionEvents } from '../hooks/useInteractionEvents.js';
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
export default function HomePage() {
    const navigate = useNavigate();
    const openDetail = useOpenDetail();
    const { currentProfile, profileVersion } = useProfile();
    const { allShelves, hero, isLoading: homeLoading, isFetchingMore, hasMore, error: homeError, loadMore, } = useInfiniteHome(currentProfile?.id ?? '', profileVersion);
    const { arrivals, refresh: refreshArrivals } = useArrivals('unread');
    const { emit: emitEvent } = useInteractionEvents();
    const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
    const sentinelRef = useRef(null);
    useEffect(() => {
        emitEvent({ eventType: 'HOME_OPENED', clientType: 'web' });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profileVersion]);
    // IntersectionObserver: call loadMore when sentinel enters viewport.
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
    const recShelves = allShelves.filter((shelf) => shelf.id !== 'sys_continue_watching');
    const isLoading = homeLoading;
    const hasContent = recShelves.length > 0 || hero !== null;
    if (!isLoading && !hasContent) {
        return (_jsxs("div", { children: [_jsx(ContinueWatchingRow, {}), _jsx(EmptyState, { icon: "\uD83D\uDCE1", heading: "Aucun contenu disponible", description: "Ajoutez une source IPTV pour commencer \u00E0 explorer votre catalogue.", action: _jsx(Button, { onClick: () => navigate('/sources'), children: "Ajouter une source" }) })] }));
    }
    return (_jsxs("div", { children: [hero && (_jsx(HeroSection, { title: hero.title, synopsis: hero.synopsis, backdropUrl: hero.backdropUrl, mediaId: hero.mediaId, trailerKey: hero.trailerKey, availabilityStatus: hero.availabilityStatus, onPlay: hero.availabilityStatus === 'AVAILABLE'
                    ? () => navigate(`/player/${hero.mediaType === 'MOVIE' ? 'movie' : 'series'}/${hero.mediaId}`)
                    : undefined, onDetails: () => openDetail(hero.mediaType === 'MOVIE' ? 'movie' : 'series', hero.mediaId), onAddToList: () => { } })), isLoading && _jsx(Spinner, {}), _jsx(ContinueWatchingRow, {}), arrivals.length > 0 && (_jsx("div", { className: "px-8 mt-8", children: _jsx(HorizontalRow, { title: "Nouveaut\u00E9s disponibles", children: arrivals.map((arrival) => (_jsx(ArrivalCard, { arrival: arrival, onDismiss: refreshArrivals }, arrival.id))) }) })), !homeLoading && homeError && recShelves.length === 0 && (_jsx(ErrorState, { message: "Impossible de charger les recommandations. Le catalogue reste disponible via Films.", onRetry: () => window.location.reload() })), homeLoading && (_jsxs(_Fragment, { children: [_jsx(ShelfSkeleton, {}), _jsx(ShelfSkeleton, {}), _jsx(ShelfSkeleton, {})] })), !homeLoading && (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex justify-end px-4 py-2", children: _jsx(Button, { variant: "secondary", size: "sm", onClick: () => setGenerateDialogOpen(true), children: "+ Cr\u00E9er une s\u00E9lection" }) }), recShelves.map((shelf) => (_jsx(ShelfErrorBoundary, { children: _jsx(ShelfRow, { shelf: shelf }) }, shelf.id)))] })), isFetchingMore && (_jsxs(_Fragment, { children: [_jsx(ShelfSkeleton, {}), _jsx(ShelfSkeleton, {}), _jsx(ShelfSkeleton, {})] })), hasMore && !isFetchingMore && _jsx("div", { ref: sentinelRef, "aria-hidden": "true" }), !hasMore && recShelves.length > 0 && (_jsx("p", { className: "text-center text-sm text-gray-600 py-8", children: "\u2014 Fin des recommandations \u2014" })), _jsx(GenerateShelfDialog, { open: generateDialogOpen, onClose: () => setGenerateDialogOpen(false), onSuccess: () => { } })] }));
}
//# sourceMappingURL=HomePage.js.map