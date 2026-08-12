All tests pass:
- **API**: 35 test files, 507 tests
- **Web**: 20 test files, 125 tests

T054 is fully implemented. The complete feature covers:
- `trailerKey` plumbed through all API routes (catalog, shelves, home)
- `autoplayPreviews` DB column + migration + profile preference UI toggle
- `PreviewContext` + `PreviewPlayer` components (YouTube-nocookie, muted autoplay)
- Hero section 2s auto-preview, poster cards 1.5s hover/focus preview
- Touch device detection and `prefers-reduced-motion` guard
- Single-active-player constraint via shared context
- All pre-existing tests still pass (no regressions)
