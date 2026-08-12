import type { ProfileTaste } from '@iptvflix/api-contracts';
export declare const SIGNAL_WEIGHTS: {
    readonly LIKE: 3;
    readonly DISLIKE: -3;
    readonly NOT_INTERESTED: -2;
    readonly COMPLETED_VIEW: 1;
    readonly IN_PROGRESS_VIEW: 0.5;
    readonly WATCHLIST: 0.5;
};
export declare function buildTaste(profileId: string): Promise<ProfileTaste>;
export declare function getTaste(profileId: string): Promise<ProfileTaste>;
//# sourceMappingURL=profile-taste-service.d.ts.map