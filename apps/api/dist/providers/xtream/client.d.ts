import type { XtreamUserInfo, XtreamCategory, XtreamVodStream, XtreamSeries, XtreamSeriesInfo } from './types.js';
interface XtreamClientConfig {
    baseUrl: string;
    username: string;
    password: string;
    timeoutMs?: number;
}
export declare class XtreamCodesClient {
    private readonly config;
    constructor(config: XtreamClientConfig);
    private buildUrl;
    private fetch;
    authenticate(): Promise<XtreamUserInfo>;
    getVodCategories(): Promise<XtreamCategory[]>;
    getVodStreams(categoryId?: string): Promise<XtreamVodStream[]>;
    getSeriesCategories(): Promise<XtreamCategory[]>;
    getSeries(categoryId?: string): Promise<XtreamSeries[]>;
    getSeriesInfo(seriesId: number): Promise<XtreamSeriesInfo>;
}
export {};
//# sourceMappingURL=client.d.ts.map