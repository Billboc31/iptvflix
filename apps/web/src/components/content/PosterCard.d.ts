type PosterCardProps = {
    title: string;
    year?: number | null;
    posterUrl?: string | null;
    quality?: string | null;
    badge?: {
        label: string;
        variant: 'unavailable' | 'upcoming';
    };
    onClick?: () => void;
};
export default function PosterCard({ title, year, posterUrl, quality, badge, onClick }: PosterCardProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=PosterCard.d.ts.map