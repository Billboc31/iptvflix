import type { ShelfResponse, ShelfSummaryResponse, ShelfItem, ShelfRuleDefinition, CreateShelfBody, UpdateShelfBody, AddShelfMemberBody } from '@iptvflix/api-contracts';
export declare function validateDynamicRules(rawRules: unknown): ShelfRuleDefinition;
export declare function evaluateDynamicShelf(rules: ShelfRuleDefinition, profileId: string): Promise<ShelfItem[]>;
export declare function listShelves(profileId: string): Promise<ShelfSummaryResponse[]>;
export declare function getShelf(shelfId: string, profileId: string): Promise<ShelfResponse>;
export declare function createShelf(profileId: string, body: CreateShelfBody): Promise<ShelfSummaryResponse>;
export declare function updateShelf(shelfId: string, profileId: string, body: UpdateShelfBody): Promise<ShelfSummaryResponse>;
export declare function deleteShelf(shelfId: string, profileId: string): Promise<void>;
export declare function addMember(shelfId: string, profileId: string, body: AddShelfMemberBody): Promise<void>;
export declare function removeMember(shelfId: string, profileId: string, mediaType: 'MOVIE' | 'SERIES', mediaId: string): Promise<void>;
export declare function reorderMembers(shelfId: string, profileId: string, orderedList: Array<{
    mediaType: 'MOVIE' | 'SERIES';
    mediaId: string;
}>): Promise<void>;
//# sourceMappingURL=shelf-service.d.ts.map