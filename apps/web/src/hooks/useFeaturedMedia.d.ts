import type { AvailabilityStatus } from '@iptvflix/api-contracts';
export type FeaturedMedia = {
    id: string;
    mediaType: 'movie' | 'series';
    title: string;
    synopsis: string | null;
    backdropUrl: string | null;
    posterUrl: string | null;
    availabilityStatus: AvailabilityStatus;
    trailerKey: string | null;
};
export declare function useFeaturedMedia(): {
    media: FeaturedMedia | null;
    loading: boolean;
};
//# sourceMappingURL=useFeaturedMedia.d.ts.map