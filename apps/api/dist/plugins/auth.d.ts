import type { FastifyRequest, FastifyReply } from 'fastify';
import { devices } from '../db/schema/index.js';
declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: {
            username: string;
            accountId?: string;
            profileId?: string;
        };
        user: {
            username: string;
            accountId?: string;
            profileId?: string;
        };
    }
}
declare module 'fastify' {
    interface FastifyRequest {
        account?: {
            id: string;
            username: string;
        };
        profileId?: string;
        device?: typeof devices.$inferSelect;
    }
}
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
export declare function requireProfile(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=auth.d.ts.map