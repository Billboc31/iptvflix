import type { GenerateShelfBody, GenerateShelfResponse } from '@iptvflix/api-contracts';
export declare function generateShelfFromSeeds(profileId: string, body: GenerateShelfBody): Promise<GenerateShelfResponse>;
export declare function refreshGeneratedShelf(shelfId: string, profileId: string): Promise<GenerateShelfResponse>;
//# sourceMappingURL=shelf-generation-service.d.ts.map