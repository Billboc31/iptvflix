# Authentication Architecture

## Scope

Single-user authentication for the hosted IPTVFlix deployment (Railway API + Vercel frontend).

Multi-user extension point: replace the `AUTH_USERNAME` / `AUTH_PASSWORD_HASH` env-var credential check in `apps/api/src/routes/auth.ts` with a database users table lookup. No other change is required — the JWT flow, cookies, and `authenticate` hook remain identical.

## Design

### Stateless JWT

- The API signs a **1-hour JWT** on successful login using `@fastify/jwt` with a secret from `JWT_SECRET`.
- No session table or revocation list. Token expiry is the sole validity boundary.
- To revoke access immediately, rotate `JWT_SECRET` in Railway and redeploy.

### Cookie vs Bearer

The `authenticate` hook (`apps/api/src/plugins/auth.ts`) accepts a JWT from **either**:

1. An `httpOnly` cookie named `token` — used by the Web frontend (set via `POST /auth/login`).
2. An `Authorization: Bearer <token>` header — intended for future Android TV and programmatic clients.

No code change is needed to add a new client type; it only needs to send the token in the `Authorization` header.

### Protected vs public endpoints

**Public** (no token required):
- `GET /health`
- `GET /movies`, `GET /movies/:id`
- `GET /series`, `GET /series/:id`, `GET /series/:id/seasons/:n/episodes`
- `GET /genres`
- `GET /search`
- `GET /release-lifecycle/:mediaType/:mediaId`
- `POST /auth/login`

**Protected** (valid JWT required):
- `GET /auth/me`, `POST /auth/logout`
- All `/sources/**`, `/sync-runs/**`
- `/profile/**`, `/watchlist/**`, `/feedback/**`
- `/progress/**`, `/continue-watching`
- `/shelves/**`, `/follow-release/**`
- `/taste/**`, `/recommendations/**`
- `/profiles/:id/home`
- `POST /discovery/**`, `/enrichment`

### CORS

`credentials: true` is set in `@fastify/cors`. `CORS_ORIGIN` must be the exact Vercel frontend origin — never `*` (browsers reject `credentials: include` with a wildcard origin).

## Environment variables

Add these to Railway (API service) before entering real source credentials:

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | Yes | Random string, 64+ characters. API won't start without it. |
| `AUTH_PASSWORD_HASH` | Yes | bcrypt hash of the admin password. API won't start without it. |
| `AUTH_USERNAME` | No | Defaults to `admin`. |

### Generating the password hash

```sh
node -e "require('bcrypt').hash('your-password', 12).then(console.log)"
```

### Generating JWT_SECRET

```sh
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Security notes

- The `token` cookie is `httpOnly` (not accessible to JavaScript), `Secure` in production (HTTPS only), and `SameSite=None` (required for cross-origin Vercel → Railway requests).
- In development (`NODE_ENV !== 'production'`), cookies are `Secure: false` and `SameSite: lax` so they work over HTTP localhost.
- Passwords and bcrypt hashes are never logged or returned in API responses.
- CSRF is mitigated by the strict `CORS_ORIGIN` check combined with `SameSite=None; Secure` cookies.
