# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T131/reviews/implementation-review.md
- generated at: 2026-08-25T09:03:32Z

---

---

## PR Review — T131

**Décision : IMPLEMENTATION_FIX_REQUIRED**

### Vue d'ensemble

L'implémentation est globalement solide : schéma DB correct avec UNIQUE constraint et FK CASCADE, pipeline de déduplication par confiance bien conçu, normalisation générique sans hardcoding, routes API fonctionnelles et correctement enregistrées, tests E2E avec fixture dédiée. L'intégration Xtream et M3U est cohérente avec l'architecture existante.

### Deux tests unitaires échouent (bloquant)

**1. `normalizeChannelName('M.6')` → attendu `m.6`, reçu `m 6`**

`channel-normalizer.ts:29` — `raw.replace(/[._]/g, ' ')` remplace aussi les points, ce qui transforme `M.6` → `m 6`. Le test attend `m.6`.

Fix recommandé : changer en `replace(/_/g, ' ')` (underscores seulement), le point est souvent significatif dans un nom de chaîne (`M6`, `C+`, etc.).

**2. `normalizeChannelName('  BFM  TV  ')` → attendu `bfm  tv`, reçu `bfm tv`**

`replace(/\s+/g, ' ')` collapse tous les espaces multiples. Résultat réel : `bfm tv` (un espace). L'assertion attend `bfm  tv` (deux espaces).

Fix recommandé : corriger l'assertion du test pour `'bfm tv'`.

### Observations mineures (non bloquantes)

- **Compteur `sourcesCreated`** peut légèrement sur-compter quand `onConflictDoNothing` s'applique silencieusement — impact diagnostic uniquement.
- **M3U `providerItemId = streamUrl`** (pas de fallback vers `tvgId`) peut accumuler des sources stales si l'URL change entre syncs.
- **`GET /channels/:id/stream` retourne `{ streamUrl: '' }` en 404** — corps trompeur pour les clients frontend.

IMPLEMENTATION_FIX_REQUIRED
