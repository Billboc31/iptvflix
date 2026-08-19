import type { CompactTasteContext } from '@iptvflix/api-contracts';
type Message = {
    role: 'system' | 'user';
    content: string;
};
export declare function buildQueryPlannerPrompt(rawQuery: string, profileContext: CompactTasteContext | null): Message[];
export {};
//# sourceMappingURL=query-planner-v1.d.ts.map