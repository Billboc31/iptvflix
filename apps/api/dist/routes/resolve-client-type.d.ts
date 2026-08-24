import type { FastifyRequest } from 'fastify';
import type { PlaybackResolveRequest } from '@iptvflix/api-contracts';
export type ResolvedClientType = 'web' | 'android-tv';
export declare function resolveClientType(request: FastifyRequest<{
    Body?: PlaybackResolveRequest;
    Querystring?: {
        clientType?: string;
    };
}>): ResolvedClientType | undefined;
//# sourceMappingURL=resolve-client-type.d.ts.map