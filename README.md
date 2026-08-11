# IPTVFlix

A modern streaming-style interface built on top of IPTV sources.

## Monorepo Structure

```
iptvflix/
├── apps/
│   ├── api/          — Fastify + TypeScript backend
│   ├── web/          — React + Vite + TypeScript frontend
│   └── android-tv/   — Kotlin/Gradle Android TV skeleton
├── packages/
│   └── api-contracts/ — Shared TypeScript types
├── package.json       — pnpm workspace root
└── pnpm-workspace.yaml
```

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| pnpm | ≥ 9 |
| JDK | ≥ 17 (Android TV only) |
| Android SDK | API 34 (Android TV only) |

## Install

```sh
pnpm install
```

## Local Development

### Start all TypeScript apps (API + Web in parallel)

```sh
pnpm dev
```

### Start apps individually

```sh
# API (http://localhost:3000)
pnpm --filter api dev

# Web (http://localhost:5173)
pnpm --filter web dev
```

The web app proxies `/api/*` requests to the API during development.

### Environment variables

Copy the example files and adjust as needed:

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

| File | Variable | Default | Description |
|------|----------|---------|-------------|
| `apps/api/.env` | `PORT` | `3000` | API listen port |
| `apps/api/.env` | `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `apps/web/.env` | `VITE_API_BASE` | `/api` | API base path for the frontend |

## API

### `GET /health`

Returns HTTP 200 with body `{ "status": "ok" }`.

```sh
curl http://localhost:3000/health
```

## Android TV

The Android TV project is a standard Gradle project located in `apps/android-tv/`.

```sh
cd apps/android-tv

# Build debug APK (requires Android SDK)
./gradlew assembleDebug
```

The APK is output to `apps/android-tv/app/build/outputs/apk/debug/`.

Jetpack Compose for TV and Media3 dependencies are present but commented out in
`apps/android-tv/app/build.gradle.kts` — ready to uncomment when feature work begins.

## Quality Commands

Run from the repo root:

```sh
# Lint all TypeScript workspaces
pnpm lint

# Type-check all TypeScript workspaces
pnpm typecheck

# Run test suites (API)
pnpm test
```

## Project Conventions

- One ticket = one branch = one PR.
- No `.env` files committed — only `.env.example` variants.
- Monorepo uses pnpm workspaces; packages reference each other via `workspace:*`.
