export type LoginRequest = { username: string; password: string }
/** `token` is required for mobile / Safari where cross-site cookies are blocked. */
export type LoginResponse = { ok: true; token: string }
export type MeResponse = { username: string; accountId?: string }
