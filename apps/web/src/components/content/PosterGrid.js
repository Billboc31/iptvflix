import { jsx as _jsx } from "react/jsx-runtime";
import PosterCard from './PosterCard.js';
export default function PosterGrid({ items, onItemClick }) {
    return (_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-6", children: items.map((item) => (_jsx(PosterCard, { title: item.title, year: item.year, posterUrl: item.posterUrl, quality: item.quality, onClick: () => onItemClick(item.id) }, item.id))) }));
}
//# sourceMappingURL=PosterGrid.js.map