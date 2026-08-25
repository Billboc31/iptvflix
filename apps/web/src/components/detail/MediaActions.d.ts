import type { WatchlistMediaType } from '@iptvflix/api-contracts';
type Props = {
    mediaType: WatchlistMediaType;
    mediaId: string;
    availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE';
    /** Full route to navigate to on play. If absent, no play button is rendered. */
    playRoute?: string | null;
    playLabel?: string;
    onPlayOnTv?: () => void;
    showPlayOnTv?: boolean;
};
export default function MediaActions({ mediaType, mediaId, availabilityStatus, playRoute, playLabel, onPlayOnTv, showPlayOnTv, }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=MediaActions.d.ts.map