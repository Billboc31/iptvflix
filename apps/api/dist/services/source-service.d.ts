import type { SourceResponse, CreateSourceBody, UpdateSourceBody, TestSourceResult } from '@iptvflix/api-contracts';
export declare class NotFoundError extends Error {
    readonly statusCode = 404;
    constructor(id: string);
}
export declare function createSource(input: CreateSourceBody): Promise<SourceResponse>;
export declare function listSources(): Promise<SourceResponse[]>;
export declare function getSource(id: string): Promise<SourceResponse>;
export declare function updateSource(id: string, patch: UpdateSourceBody): Promise<SourceResponse>;
export declare function deleteSource(id: string): Promise<void>;
export declare function testSourceConnection(id: string): Promise<TestSourceResult>;
//# sourceMappingURL=source-service.d.ts.map