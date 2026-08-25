export type ApiState<T> = {
    data: T | null;
    loading: boolean;
    error: Error | null;
    refetch: () => void;
};
export declare function useApi<T>(fetcher: () => Promise<T>): ApiState<T>;
//# sourceMappingURL=useApi.d.ts.map