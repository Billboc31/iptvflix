import type { ShelfConceptProfileContext } from '@iptvflix/api-contracts';
type Message = {
    role: 'system' | 'user';
    content: string;
};
export declare function buildShelfConceptPrompt(context: ShelfConceptProfileContext, counts: {
    personalized: number;
    exploration: number;
    discovery: number;
}): Message[];
export {};
//# sourceMappingURL=shelf-concept-generator-v1.d.ts.map