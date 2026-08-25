export interface ChannelSourceRecord {
    id: string;
    channelId: string;
    sourceId: string;
    streamUrl: string;
    priority: number;
    status: 'AVAILABLE' | 'UNAVAILABLE';
    lastSeenAt: Date;
}
export declare function selectPreferredSources(sources: ChannelSourceRecord[]): ChannelSourceRecord[];
//# sourceMappingURL=source-selector.d.ts.map