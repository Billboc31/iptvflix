import type { SyncRunResponse } from '@iptvflix/api-contracts';
type SyncStatusBannerProps = {
    latestRun?: SyncRunResponse | null;
    onSync: () => Promise<void>;
    syncing?: boolean;
};
export default function SyncStatusBanner({ latestRun, onSync, syncing, }: SyncStatusBannerProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=SyncStatusBanner.d.ts.map