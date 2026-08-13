## Objective

Add a stateless JWT-based single-user authentication layer to the IPTVFlix API (Fastify on Railway) and protect sensitive endpoints. The web frontend (Vercel) uses a login form that receives a secure httpOnly cookie; future Android TV clients can reuse the same JWT via an `Authorization: Bearer` header without code changes.

---

## Included

### Backend — `apps/api`

**New Fastify auth plugin `src/plugins/auth.ts`**
- Registers `@fastify/jwt` (reads `JWT_SECRET` env var; API startup fails with a clear error if absent) and `@fastify/cookie`
- Decorates `FastifyInstance` with `app.authenticate` — an `onRequest` hook that accepts a JWT from either the `token` httpOnly cookie **or** an `Authorization: Bearer` header
- Returns `401 Unauthorized` for missing / invalid / expired tokens

**New route module `src/routes/auth.ts`**
- `POST /auth/login` (public): body `{ username, password }`, compares password against `AUTH_PASSWORD_HASH` (bcrypt) from env, signs a 1-hour JWT, sets it as an httpOnly `Secure; SameSite=None` cookie named `token`, returns `{ ok: true }`
- `POST /auth/logout` (protected via `app.authenticate`): clears the `token` cookie, returns `{ ok: true }`
- `GET /auth/me` (protected): returns `{ username }` — used by the frontend to restore session on page load

**Route protection in `src/index.ts`**
- Register auth plugin before any route plugin
- Add `{ preHandler: app.authenticate }` to every handler in the following route modules:
  - All `/sources/**` (list, get, create, update, delete, credentials)
  - All `/sync/**` (trigger, status)
  - All `/profile` and `/profile/preferences` (read + write)
  - All `/watchlist/**`
  - All `/feedback/**`
  - All playback/stream URL routes
- Catalog read routes (`/movies`, `/series`, `/genres`, `/search`) remain **public** — ticket restricts source/profile/sync/playback, not catalog browsing
- `GET /health` stays public, response body unchanged

**CORS update in `src/index.ts`**
- Set `credentials: true` in the `@fastify/cors` plugin options
- `CORS_ORIGIN` env var must be the exact Vercel frontend origin (not `*`) — validated at startup

**New env vars — add to `apps/api/.env.example`**
```
AUTH_USERNAME=admin
AUTH_PASSWORD_HASH=<bcrypt hash — generate with: node -e "require('bcrypt').hash('your-pw',12).then(console.log)">
JWT_SECRET=<random 64+ char string>
```

**New test file `src/routes/auth.test.ts`** (Vitest + `app.inject()` pattern)
- `POST /auth/login` valid credentials → 200, cookie set
- `POST /auth/login` wrong password → 401, no cookie
- `POST /auth/login` unknown username → 401
- `GET /sources` without token → 401
- `GET /sources` with valid cookie → passes through (mock service returns 200)
- `GET /auth/me` with valid cookie → 200 `{ username }`
- `GET /auth/me` with expired / tampered token → 401
- `POST /auth/logout` → cookie cleared
- `GET /health` without token → 200

**New dependencies** (`apps/api/package.json`)
- `@fastify/jwt`
- `@fastify/cookie`
- `bcrypt` + `@types/bcrypt`

---

### API Contracts — `packages/api-contracts`

**New file `src/auth.ts`**
```ts
export type LoginRequest = { username: string; password: string }
export type LoginResponse = { ok: true }
export type MeResponse = { username: string }
```

**Update `src/index.ts`** — re-export the three new types

---

### Web Frontend — `apps/web`

**`src/lib/api.ts`**
- Add `credentials: 'include'` to every `fetch()` call (required for cross-origin cookie)
- Add `login(username: string, password: string): Promise<void>`
- Add `logout(): Promise<void>`
- Add `getMe(): Promise<MeResponse>`

**New `src/context/AuthContext.tsx`**
- `AuthContext` with `{ isAuthenticated: boolean; username: string | null; login; logout }`
- `AuthProvider` calls `getMe()` on mount; sets `isAuthenticated = true` on success, `false` on 401 — covers page-refresh session restore
- `login()` calls `POST /auth/login`, then `getMe()` to populate state
- `logout()` calls `POST /auth/logout`, clears state

**New `src/pages/LoginPage.tsx`**
- Form: username field + password field + submit button
- On success → `navigate('/')`, on failure → inline error message
- No redirect loop when already authenticated

**New `src/components/ProtectedRoute.tsx`**
- If `isAuthenticated`: render children
- If not authenticated and auth check complete: `<Navigate to="/login" replace />`
- While auth check is in-flight: render null or a loading spinner (avoids flash)

**`src/App.tsx`**
- Wrap the router with `<AuthProvider>`
- Add `/login` route → `<LoginPage />`
- Wrap all existing page routes with `<ProtectedRoute>`

---

### Documentation — `docs/architecture/auth.md` (new file)

Content to cover:
- Single-user scope rationale and extension point (multi-user: replace env-var credential check with DB users table, no other change required)
- JWT stateless design: no session DB table, 1-hour expiry, no revocation list
- Cookie vs Bearer: the `authenticate` plugin accepts both; web uses cookie, Android TV will use `Authorization: Bearer`
- Required env vars and how to generate `AUTH_PASSWORD_HASH`
- CORS `credentials: true` requirement and why `CORS_ORIGIN` must not be `*`

---

## Excluded

- Database migration / users table (credentials live entirely in env vars)
- Multi-user accounts or household management
- OAuth / social login
- Role or permission matrices
- Android TV login UI
- CSRF token implementation (mitigated by `SameSite=None; Secure` + strict CORS origin check)
- Session revocation / token blacklist (short JWT expiry is sufficient for single-user)
- Password-change UI (rotation is done via Railway env var update + redeploy)
- Protecting catalog read endpoints (`/movies`, `/series`, `/search`, etc.)

---

## Acceptance criteria

- `GET /sources` with no token → `401 Unauthorized`
- `POST /auth/login` with correct credentials → `200`, `Set-Cookie: token=…; HttpOnly; Secure; SameSite=None`
- `POST /auth/login` with wrong password or unknown username → `401`, no cookie set
- `GET /health` with no token → `200`, response body contains no secrets
- `GET /auth/me` with valid cookie → `200 { username: "…" }`
- `GET /auth/me` with expired or tampered token → `401`
- `POST /auth/logout` → `token` cookie cleared
- Web: navigating to any protected page while unauthenticated redirects to `/login`
- Web: after successful login, protected pages render without re-prompting
- Web: page refresh restores session (no login prompt if cookie is still valid)
- API: absent `JWT_SECRET` or `AUTH_PASSWORD_HASH` → startup fails with a descriptive error before accepting connections
- No password, token, or bcrypt hash appears in Fastify logs or any API response body
- All auth tests pass: `pnpm --filter api test` green
- `pnpm typecheck` passes across the monorepo
