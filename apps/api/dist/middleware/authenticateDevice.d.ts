import type { FastifyRequest, FastifyReply } from 'fastify';
import { devices } from '../db/schema/index.js';
export type AuthenticatedDevice = typeof devices.$inferSelect;
export declare function authenticateDevice(request: FastifyRequest, reply: FastifyReply): Promise<AuthenticatedDevice | null>;
//# sourceMappingURL=authenticateDevice.d.ts.map