All 522 tests pass across 36 test files. Let me do a final summary of what was implemented.

---

## Implementation complete

All tests pass (522/522). Here's what was created/modified:

### New files

| File | Purpose |
|---|---|
| `apps/api/src/plugins/auth.ts` | `authenticate` preHandler hook — accepts JWT from `token` cookie or `Authorization: Bearer` |
| `apps/api/src/routes/auth.ts` | `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` |
| `apps/api/src/routes/auth.test.ts` | 15 tests: login success/failure, unauthenticated denial, valid cookie, Bearer header, expired/tampered token, logout |
| `packages/api-contracts/src/auth.ts` | `LoginRequest`, `LoginResponse`, `MeResponse` types |
| `apps/web/src/context/AuthContext.tsx` | React auth state — session restore on mount via `getMe()` |
| `apps/web/src/pages/LoginPage.tsx` | Login form with error handling |
| `apps/web/src/components/ProtectedRoute.tsx` | Route guard using `<Outlet />` for React Router v6 nested routes |
| `docs/architecture/auth.md` | Single-user rationale, JWT design, cookie vs Bearer, env var setup |

### Modified files

| File | Change |
|---|---|
| `apps/api/src/config/env.ts` | Added `JWT_SECRET`, `AUTH_USERNAME`, `AUTH_PASSWORD_HASH` validation (startup fails if missing) |
| `apps/api/src/index.ts` | Registers `@fastify/jwt` + `@fastify/cookie`, auth routes (public), protected scope with `authenticate` hook |
| `apps/api/.env.example` | Added 3 new env vars with generation instructions |
| `apps/api/vitest.config.ts` | Added test env vars so existing tests don't break on new startup validation |
| `apps/api/package.json` | Added `@fastify/jwt@^8`, `@fastify/cookie@^9`, `bcrypt`, `@types/bcrypt` |
| `packages/api-contracts/src/index.ts` | Re-exports `./auth.js` |
| `apps/web/src/lib/api.ts` | Added `credentials: 'include'` to all fetches; added `login()`, `logout()`, `getMe()` |
| `apps/web/src/App.tsx` | Wrapped routes with `<AuthProvider>` and `<ProtectedRoute />`; added `/login` route |

### Key design decisions

- **Cookie + Bearer dual-mode**: `authenticate` checks `token` cookie first (web), falls back to `Authorization: Bearer` (future Android TV) — no code change needed for new clients
- **Scoped protection in `index.ts`**: public routes (health, movies, series, genres, search, catalog detail) stay outside the `protectedScope`; all user-state and source-management routes are inside
- **Development cookies**: `Secure: false`, `SameSite: lax` in non-production so HTTP localhost works; `Secure: true`, `SameSite: none` in production for cross-origin Railway→Vercel
