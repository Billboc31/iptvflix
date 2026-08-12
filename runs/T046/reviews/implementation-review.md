The review is complete. Here's a summary of the findings:

---

## Review — T046 Authentication

**Decision: IMPLEMENTATION_FIX_REQUIRED**

The implementation is architecturally solid — JWT verified server-side, cookies correctly configured for the Vercel→Railway cross-origin topology, bcrypt for password hashing, clean Fastify scoped preHandler protecting all sensitive routes. Three targeted fixes are needed:

### Blocking fixes

1. **`CORS_ORIGIN` not validated against `*`** (`apps/api/src/config/env.ts:18`) — the plan explicitly required startup validation. If set to `*`, browsers silently reject all credentialed requests, breaking auth entirely in production. Add a `throw` if `corsOriginRaw === '*'`.

2. **`.env.example` says `bcryptjs`, code uses `bcrypt`** (`apps/api/.env.example:8`) — the generate command references the wrong package. Should be `require('bcrypt')` to match the actual dependency. The hashes are algorithm-compatible but the example would fail on a fresh machine.

3. **`LoginPage.tsx` calls `navigate()` during render** (`apps/web/src/pages/LoginPage.tsx:14-17`) — imperative `navigate()` inside the render function is a React anti-pattern. Replace with `<Navigate to="/" replace />`.

### Non-blocking observations

- The health test in `auth.test.ts` is a no-op (`expect(true).toBe(true)`) — actual behaviour is covered by `health.test.ts`
- `AuthContext` redirects to `/login` on network errors, not just 401 — UX concern
- `sources.test.ts` doesn't test auth enforcement at the route level (covered by integration via `index.ts`)
