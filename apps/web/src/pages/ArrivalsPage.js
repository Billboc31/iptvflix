import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useArrivals } from '../hooks/useArrivals.js';
import ArrivalCard from '../components/content/ArrivalCard.js';
import Spinner from '../components/ui/Spinner.js';
import EmptyState from '../components/ui/EmptyState.js';
export default function ArrivalsPage() {
    const [filter, setFilter] = useState('unread');
    const { arrivals, isLoading, refresh } = useArrivals(filter);
    function handleDismiss(_id) {
        refresh();
    }
    return (_jsxs("div", { className: "px-8 py-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-2xl font-bold text-white", children: "Nouveaut\u00E9s disponibles" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setFilter('unread'), className: `px-3 py-1 rounded text-sm transition-colors ${filter === 'unread'
                                    ? 'bg-[#e50914] text-white'
                                    : 'bg-white/10 text-gray-400 hover:text-white'}`, children: "Non lues" }), _jsx("button", { onClick: () => setFilter('all'), className: `px-3 py-1 rounded text-sm transition-colors ${filter === 'all'
                                    ? 'bg-[#e50914] text-white'
                                    : 'bg-white/10 text-gray-400 hover:text-white'}`, children: "Toutes" })] })] }), isLoading && _jsx(Spinner, {}), !isLoading && arrivals.length === 0 && (_jsx(EmptyState, { icon: "\uD83C\uDF89", heading: "Aucune nouveaut\u00E9", description: "Les contenus que vous suivez appara\u00EEtront ici d\u00E8s qu'ils seront disponibles sur vos sources." })), !isLoading && arrivals.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-4", children: arrivals.map((arrival) => (_jsx(ArrivalCard, { arrival: arrival, onDismiss: filter === 'unread' ? handleDismiss : undefined }, arrival.id))) }))] }));
}
//# sourceMappingURL=ArrivalsPage.js.map