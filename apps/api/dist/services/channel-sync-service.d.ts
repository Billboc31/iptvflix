export interface LiveChannelEntry {
    providerItemId: string;
    providerName: string;
    streamUrl: string;
    tvgId?: string | null;
    tvgLogo?: string | null;
    groupTitle?: string | null;
    priority?: number;
}
export interface ChannelSyncResult {
    channelsCreated: number;
    channelsUpdated: number;
    sourcesCreated: number;
    sourcesUpdated: number;
    unavailableCount: number;
}
export declare const ChannelSyncService: {
    syncLiveChannels(sourceId: string, entries: LiveChannelEntry[], opts?: {
        skipLifecycle?: boolean;
    }): Promise<ChannelSyncResult>;
};
//# sourceMappingURL=channel-sync-service.d.ts.map