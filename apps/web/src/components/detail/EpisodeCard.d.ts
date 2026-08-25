import type { EpisodeResponse, DeviceResponse } from '@iptvflix/api-contracts';
type Props = {
    episode: EpisodeResponse;
    devices?: DeviceResponse[];
    progressMs?: number;
    seriesId?: string;
    seasonNumber?: number;
};
export default function EpisodeCard({ episode, devices, progressMs, seriesId, seasonNumber }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=EpisodeCard.d.ts.map