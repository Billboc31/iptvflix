---

## Review — T093: Preserve and display useful provider variant labels

### Résumé

Implémentation complète et fidèle au plan. 15 fichiers (11 modifiés + 4 créés) couvrent exactement le périmètre prescrit. Tous les critères d'acceptation du ticket sont satisfaits.

### Points validés

**Migration DB** — `IF NOT EXISTS` sur chaque `ALTER TABLE`, idempotente. Journal mis à jour (index 34). 4 colonnes nullable sur les 3 tables.

**Extracteur** — Ordre des regex correct (HDR10 avant HDR, H.265 avant H.264, VOSTFR guard bloquant le match `\bFR\b`). Case-insensitive → `1080P` du ticket géré. MULTI correctement en `audioFormat`, pas `audioLanguage`.

**Backfill** — Filtre idempotent (`COALESCE`, skip sur `rawTitle IS NULL`). Table names via liste figée + `sql()` tag → pas d'injection. `sql.end()` dans `finally`.

**Contrat API** — `AvailabilityVariantResponse` enrichi de 5 champs. `providerId` conservé pour usage interne, jamais exposé comme label.

**Routes** — `leftJoin` correct avec cast `sources.id::text` nécessaire. Les 3 endpoints (movie, series, episode) enrichis symétriquement.

**Formatter partagé** — `formatVariantLabel` est **l'unique** formatter frontend (confirmé par grep). `AvailabilityPanel` et `PlayerControls` passent correctement la liste complète de variantes pour la désambiguïsation. Fallback `rawTitle ?? 'Source inconnue'` — jamais de UUID affiché.

**Tests** — 3 exemples ticket validés end-to-end, 16 cas extractor, 15 cas formatter (disambiguation, fallbacks, UUID check).

### Observations non-bloquantes

- `audioFormat` (DTS, Atmos, etc.) stocké mais absent du label — cohérent avec l'ordre d'assemblage du plan, données disponibles pour usage futur.
- `codecName` stocké mais absent du label — idem.
- `audioLanguage` limité à `'fr' | 'en'` dans le type TypeScript — extensible côté DB/runtime via `getLanguageName()`.
- Le backfill nécessite une exécution manuelle post-déploiement — à documenter dans le README/package scripts si ce n'est pas encore fait.

---

IMPLEMENTATION_APPROVED
