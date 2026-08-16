import type { MovieFilters, SeriesFilters } from '@iptvflix/api-contracts';
type Filters = MovieFilters | SeriesFilters;
type FilterBarProps = {
    value: Filters;
    onChange: (filters: Filters) => void;
    showQuality?: boolean;
    genres?: {
        id: string;
        name: string;
    }[];
};
export default function FilterBar({ value, onChange, showQuality, genres, }: FilterBarProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=FilterBar.d.ts.map