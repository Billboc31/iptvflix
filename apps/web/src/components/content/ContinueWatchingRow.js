import { jsx as _jsx } from "react/jsx-runtime";
import { useContinueWatching } from '../../hooks/useContinueWatching.js';
import HorizontalRow from './HorizontalRow.js';
import ContinueWatchingCard from './ContinueWatchingCard.js';
export default function ContinueWatchingRow() {
    const { items, loading, dismissItem, dismissError, dismissErrorFor } = useContinueWatching();
    if (loading || items.length === 0)
        return null;
    return (_jsx("div", { className: "mt-8", children: _jsx(HorizontalRow, { title: "Continuer \u00E0 regarder", children: items.map((item) => (_jsx("div", { className: "relative flex-shrink-0 w-28 md:w-32 lg:w-36 snap-start", children: _jsx(ContinueWatchingCard, { item: item, onDismiss: dismissItem, dismissError: item.mediaId === dismissErrorFor ? dismissError : null }) }, item.id))) }) }));
}
//# sourceMappingURL=ContinueWatchingRow.js.map