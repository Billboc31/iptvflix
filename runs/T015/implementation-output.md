All three files look correct. Here's a summary of changes:

**Files created**
- `docs/architecture/domain-model.md` — new canonical domain reference defining Media, Availability, Source, Shelf, the Series→Season→Episode hierarchy, four explicit invariants, global release lifecycle vs. "available to me", current schema alignment table, and four known evolution points.

**Files modified**
- `docs/product/vision.md` — value proposition reframed from "IPTV discovery layer" to "universal personal media library"; Plex added as a future Source adapter (not a competing model) in MVP roadmap and "What Is Not" section; "Provider independence" principle generalised.
- `docs/architecture/overview.md` — "Provider adapter isolation" principle renamed to "Source adapter isolation" and linked to the new domain model; `providers/<name>/` row in the module table now names IPTV, Plex, and future sources; "Related Docs" section now lists `domain-model.md` first.

No files outside `docs/` were touched, and no schema or runtime code was changed.
