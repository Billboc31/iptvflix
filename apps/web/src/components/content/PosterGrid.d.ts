type ContentItem = {
    id: string;
    title: string;
    year?: number | null;
    posterUrl?: string | null;
    quality?: string | null;
};
type PosterGridProps = {
    items: ContentItem[];
    onItemClick: (id: string) => void;
};
export default function PosterGrid({ items, onItemClick }: PosterGridProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=PosterGrid.d.ts.map