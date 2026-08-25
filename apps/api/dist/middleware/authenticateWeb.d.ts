import type { FastifyRequest, FastifyReply } from 'fastify';
/**
 * Auth for web-initiated device/pairing routes.
 * Accepts either the legacy static WEB_SECRET or a logged-in user's JWT (same as /auth/login).
 */
export declare function authenticateWeb(request: FastifyRequest, reply: FastifyReply): Promise<boolean>;
//# sourceMappingURL=authenticateWeb.d.ts.map