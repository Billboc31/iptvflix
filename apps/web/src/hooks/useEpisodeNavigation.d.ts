import type { EpisodeResponse } from '@iptvflix/api-contracts';
type EpisodeNav = {
    episodeLabel: string | null;
    nextEpisode: EpisodeResponse | null;
    previousEpisode: EpisodeResponse | null;
};
export declare function useEpisodeNavigation(mediaId: string | null, seriesId: string | null, seasonNumber: number | null): EpisodeNav;
export {};
//# sourceMappingURL=useEpisodeNavigation.d.ts.map