import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function GenreChips({ genres, selected, onSelect }) {
    return (_jsxs("div", { className: "flex gap-2 overflow-x-auto scrollbar-hide px-4 md:px-8 py-3", children: [_jsx("button", { onClick: () => onSelect(undefined), className: `shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selected === undefined
                    ? 'bg-[#e50914] text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'}`, children: "Tous" }), genres.map((genre) => (_jsx("button", { onClick: () => onSelect(genre.id), className: `shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${selected === genre.id
                    ? 'bg-[#e50914] text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'}`, children: genre.name }, genre.id)))] }));
}
//# sourceMappingURL=GenreChips.js.map