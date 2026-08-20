export declare function runCompaction(): Promise<{
    deleted: number;
    anonymized: number;
}>;
export declare function getRetentionStats(): Promise<{
    analyticsOverdue: number;
    standardOverdue: number;
    searchQueryOverdue: number;
}>;
//# sourceMappingURL=retention-service.d.ts.map