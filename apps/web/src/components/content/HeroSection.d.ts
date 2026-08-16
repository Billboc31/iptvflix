import type { AvailabilityStatus } from '@iptvflix/api-contracts';
type HeroSectionProps = {
    title: string;
    synopsis?: string | null;
    backdropUrl?: string | null;
    mediaId?: string;
    trailerKey?: string | null;
    availabilityStatus?: AvailabilityStatus;
    onPlay?: () => void;
    onDetails?: () => void;
    onAddToList?: () => void;
};
export default function HeroSection({ title, synopsis, backdropUrl, mediaId, trailerKey, availabilityStatus, onPlay, onDetails, onAddToList, }: HeroSectionProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=HeroSection.d.ts.map