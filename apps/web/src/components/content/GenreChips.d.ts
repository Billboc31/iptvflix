import type { GenreResponse } from '@iptvflix/api-contracts';
type GenreChipsProps = {
    genres: GenreResponse[];
    selected: string | undefined;
    onSelect: (genreId: string | undefined) => void;
};
export default function GenreChips({ genres, selected, onSelect }: GenreChipsProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=GenreChips.d.ts.map