import type { SeasonSummary, DeviceResponse } from '@iptvflix/api-contracts';
type Props = {
    seriesId: string;
    seasons: SeasonSummary[];
    profileId?: string;
    devices?: DeviceResponse[];
    progressByEpisodeId?: Record<string, number>;
};
export default function SeasonSelector({ seriesId, seasons, profileId, devices, progressByEpisodeId }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=SeasonSelector.d.ts.map