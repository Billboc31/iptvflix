# T001 — Initialize IPTVFlix monorepo foundation

**Source**: GitHub Issue #2

## Description

## Objective
Create the initial monorepo foundation for IPTVFlix so the backend API, web application, and Android TV application can evolve in one repository with clear boundaries and shared tooling where appropriate.

## Context / Problem
The repository is currently empty. IPTVFlix is intended to provide a modern streaming-style experience on top of IPTV sources, with a web application first and an Android TV client later. The project needs a clean foundation before feature work starts.

## Included
- Create a monorepo containing:
  - `apps/api` for the TypeScript backend.
  - `apps/web` for the React web application.
  - `apps/android-tv` for the native Android TV application.
- Use a pnpm workspace for TypeScript projects.
- Configure Fastify + TypeScript for the API.
- Configure React + TypeScript + Vite for the web application.
- Create a minimal Kotlin/Gradle Android TV project skeleton suitable for Jetpack Compose for TV and Media3 integration later.
- Add shared TypeScript packages only where they provide clear value, especially API contracts/configuration/tooling.
- Add baseline linting, formatting, type-checking and test commands.
- Add local development documentation and environment configuration examples.
- Keep the initial architecture as a modular monolith; do not introduce microservices.

## Acceptance Criteria
- [ ] The repository can be installed from the root with documented commands.
- [ ] API and web applications can both be started locally.
- [ ] The API exposes a minimal health endpoint.
- [ ] The web application renders a minimal shell and can communicate with the API in local development.
- [ ] The Android TV project builds as a minimal application skeleton.
- [ ] Root-level lint/type-check/test commands work for the applicable projects.
- [ ] Environment-specific secrets are not committed.
- [ ] The README explains the monorepo structure and local startup procedure.

## Excluded / Out of scope
- IPTV ingestion.
- Database domain modelling beyond what is required to bootstrap tooling.
- Production deployment.
- Final visual design.
- Android TV playback/navigation features.

## Dependencies
None. This is the foundation ticket for the initial batch.
