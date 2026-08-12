import type { SourceResponse, CreateSourceBody, UpdateSourceBody, TestSourceResult } from '@iptvflix/api-contracts';
export type SourcesState = {
    sources: SourceResponse[] | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
    createSource: (body: CreateSourceBody) => Promise<SourceResponse>;
    updateSource: (id: string, body: UpdateSourceBody) => Promise<SourceResponse>;
    deleteSource: (id: string) => Promise<void>;
    testSource: (id: string) => Promise<TestSourceResult>;
};
export declare function useSources(): SourcesState;
//# sourceMappingURL=useSources.d.ts.map