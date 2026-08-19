export interface BackfillResult {
    processed: number;
    succeeded: number;
    failed: number;
}
export interface BackfillState extends BackfillResult {
    startedAt: Date;
    completedAt?: Date;
}
export declare class EpisodeBackfillService {
    private latestState;
    private running;
    backfill(opts?: {
        force?: boolean;
    }): Promise<BackfillResult>;
    getLatestState(): BackfillState | null;
    private backfillSource;
    /** Series with TMDB seasons but no Xtream episode sources yet. */
    private filterMissingEpisodeAvailabilities;
}
//# sourceMappingURL=episode-backfill-service.d.ts.map