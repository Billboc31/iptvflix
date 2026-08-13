import type { M3UCatalogSnapshot } from './types.js';
interface M3UClientConfig {
    playlistUrl: string;
    username?: string;
    password?: string;
    timeoutMs?: number;
}
export declare function sanitizeUrl(url: string): string;
export declare class M3UClient {
    private readonly resolvedUrl;
    private readonly timeoutMs;
    constructor(config: M3UClientConfig);
    testConnection(): Promise<{
        ok: boolean;
        message?: string;
    }>;
    fetchSnapshot(sourceId: string): Promise<M3UCatalogSnapshot>;
}
export {};
//# sourceMappingURL=client.d.ts.map