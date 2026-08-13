import type { FastifyRequest, FastifyReply } from 'fastify';
declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: {
            username: string;
        };
        user: {
            username: string;
        };
    }
}
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
//# sourceMappingURL=auth.d.ts.map