# T004 — Implement IPTV source management

**Source**: GitHub Issue #5

## Description

## Objective
Allow IPTVFlix to register and manage IPTV sources independently from the provider-specific ingestion logic, starting with Xtream Codes while keeping the model ready for M3U.

## Context / Problem
Users need to configure one or more IPTV sources before the catalog can be synchronized. Credentials and source configuration are sensitive and must not leak through APIs, logs, or frontend state unnecessarily.

## Included
- Define the source model with at least `XTREAM` and `M3U` source types.
- Add API operations needed to create, list, inspect, update, enable/disable, and remove sources.
- For Xtream Codes, support server/base URL, username, and password credentials.
- Store secrets safely for the intended self-hosted/local deployment model and ensure they are never returned in clear text by read APIs.
- Add a connection-test capability that validates a source without importing the full catalog.
- Return useful, sanitized connection errors.
- Keep source management separated from catalog synchronization.

## Acceptance Criteria
- [ ] An Xtream Codes source can be created with server URL, username, and password.
- [ ] Source list/detail endpoints never return the clear-text password or equivalent secret.
- [ ] Credentials are not written to application logs.
- [ ] A source connection can be tested and returns a clear success/failure result.
- [ ] Invalid or unreachable source configurations are handled without crashing the API.
- [ ] Sources can be enabled/disabled without deleting their configuration.
- [ ] The domain can represent an M3U source even though M3U ingestion is not implemented in this ticket.
- [ ] Automated tests cover validation, secret redaction, and error cases.

## Excluded / Out of scope
- Catalog import/synchronization.
- M3U parsing.
- Web UI beyond API/contracts needed by later tickets.

## Dependencies
Requires #3 for persistence. Can proceed in parallel with #4 once the common project foundation is available.
