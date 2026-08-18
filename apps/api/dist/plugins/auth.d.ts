import type { FastifyRequest, FastifyReply } from 'fastify';
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
    }
}
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
export declare function requireProfile(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=auth.d.ts.map