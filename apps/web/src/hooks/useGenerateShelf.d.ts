import type { GenerateShelfBody, GenerateShelfResponse } from '@iptvflix/api-contracts';
export type UseGenerateShelfResult = {
    generate: (body: GenerateShelfBody) => Promise<GenerateShelfResponse>;
    loading: boolean;
    error: Error | null;
};
export declare function useGenerateShelf(): UseGenerateShelfResult;
//# sourceMappingURL=useGenerateShelf.d.ts.map