## Objective

Bootstrap the IPTVFlix monorepo from an empty repository: establish a pnpm workspace containing a Fastify/TypeScript API (health endpoint), a React/Vite/TypeScript web app (minimal shell communicating with the API), a Kotlin/Gradle Android TV skeleton (Leanback-ready), a shared `api-contracts` package, and root-level lint/typecheck/test scripts. The result is a working local dev environment that satisfies every acceptance criterion in the ticket.

## Included

### Root level
- `package.json` — pnpm workspace root; scripts: `dev`, `build`, `lint`, `typecheck`, `test`
- `pnpm-workspace.yaml` — globs `apps/*` and `packages/*`
- `tsconfig.base.json` — shared TypeScript compiler options (strict, ESNext, bundler resolution)
- `eslint.config.js` — flat ESLint config with TypeScript and Prettier rules
- `.prettierrc` — shared Prettier config
- `.env.example` — placeholder for any future root env vars
- `.gitignore` — covers `node_modules`, `dist`, `.env`, Android build dirs (`build/`, `.gradle/`, `*.apk`, `*.aab`)
- `README.md` — monorepo layout diagram, prerequisites (Node, pnpm, JDK), `pnpm install` + `pnpm dev` startup, per-app dev commands, lint/test commands

### `packages/api-contracts`
- `package.json` — `name: "@iptvflix/api-contracts"`, zero runtime deps
- `tsconfig.json` — extends `../../tsconfig.base.json`
- `src/index.ts` — exports `HealthResponse` type (`{ status: string }`)

### `apps/api`
- `package.json` — deps: `fastify`, `@fastify/cors`; devDeps: `typescript`, `tsx`, `vitest`, `@iptvflix/api-contracts`; scripts: `dev` (`tsx watch src/index.ts`), `build` (`tsc`), `typecheck`, `lint`, `test`
- `tsconfig.json` — extends `../../tsconfig.base.json`
- `.env.example` — `PORT=3000`, `CORS_ORIGIN=http://localhost:5173`
- `src/index.ts` — Fastify server: registers CORS, mounts routes, listens on `PORT`
- `src/routes/health.ts` — `GET /health` handler returning `{ status: "ok" }` typed as `HealthResponse`
- `src/routes/health.test.ts` — Vitest unit test injecting the route and asserting HTTP 200 + body
- `vitest.config.ts`

### `apps/web`
- `package.json` — deps: `react`, `react-dom`; devDeps: `typescript`, `vite`, `@vitejs/plugin-react`, `@iptvflix/api-contracts`; scripts: `dev`, `build`, `typecheck`, `lint`, `preview`
- `tsconfig.json` — extends `../../tsconfig.base.json`
- `vite.config.ts` — `server.proxy`: `/api` → `http://localhost:3000` (strips prefix)
- `index.html` — Vite entry HTML
- `.env.example` — `VITE_API_BASE=/api`
- `src/main.tsx` — React root mount
- `src/App.tsx` — fetches `VITE_API_BASE + /health` on mount, renders API status (or error state)

### `apps/android-tv`
- `settings.gradle.kts` — `rootProject.name = "iptvflix-android-tv"`
- `build.gradle.kts` (root) — Kotlin/Android plugin versions, no extra config
- `gradle/wrapper/gradle-wrapper.properties` — Gradle 8.x wrapper URL
- `gradlew` + `gradlew.bat` — standard Gradle wrapper scripts
- `app/build.gradle.kts` — Android application module; `minSdk 21`, `targetSdk 34`, Kotlin, Jetpack Compose for TV dependency block (commented, ready to uncomment)
- `app/src/main/AndroidManifest.xml` — `LEANBACK_LAUNCHER` intent filter, `android.software.leanback` uses-feature
- `app/src/main/kotlin/com/iptvflix/androidtv/MainActivity.kt` — `ComponentActivity` subclass with empty `onCreate`
- `app/src/main/res/values/strings.xml` — app name string
- `.gitignore` (inside `apps/android-tv`) — Android-specific ignores

## Excluded

- IPTV source ingestion or stream proxying
- Database schema, ORM, or migrations
- Authentication and user management
- Production deployment (Docker, CI/CD, cloud config)
- Final visual design or UI component library
- Android TV navigation, playback, or Media3 integration
- End-to-end tests (Playwright, Espresso)
- Multi-environment config beyond `.env.example`

## Acceptance criteria

- `pnpm install` at repo root completes without error and installs all workspaces.
- `pnpm --filter api dev` starts the Fastify server; `curl http://localhost:3000/health` returns HTTP 200 with body `{"status":"ok"}`.
- `pnpm --filter web dev` starts Vite; the browser renders the minimal shell and displays the API health status fetched via the dev proxy.
- `cd apps/android-tv && ./gradlew assembleDebug` succeeds and produces an APK.
- `pnpm -w run lint` passes with no errors across all TypeScript workspaces.
- `pnpm -w run typecheck` passes with no TypeScript errors.
- `pnpm -w run test` runs the Vitest suite for `apps/api` and passes (health route test).
- No `.env` file (only `.env.example` variants) is present in any committed changeset.
- `README.md` at repo root explains the folder structure and documents the exact commands to install, start, lint, and test each application.
