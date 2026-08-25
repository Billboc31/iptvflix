---

## PR Review — T130: Standalone Live TV App

### Résumé

L'implémentation est **complète et conforme** au ticket. Tous les critères d'acceptation sont satisfaits.

---

### Points validés

- **App standalone** `apps/live-tv/` buildable et déployable indépendamment via `pnpm --filter @iptvflix/live-tv build` + `nixpacks.toml` Railway
- **Switch VOD/TV** implémenté dans les deux apps (TopBar live-tv + TopNav web) avec `aria-selected` correct et handoff de token transparent
- **Navigation sidebar** : les 5 items requis présents (Accueil TV, Favoris, Récemment regardées, Guide TV, Toutes les chaînes)
- **Packages partagés réutilisés** : `@iptvflix/api-contracts` importé dans les deux apps, aucune duplication des types auth/profile/channel
- **Thème dark + orange** (`#0a0a0f` + `#f97316`) conforme à la maquette
- **Apps existantes non régressées** — changements purement additifs sur VOD web et API
- **6 smoke tests E2E** couvrant health, redirect non-auth, login, profile selection, sidebar nav, toggle VOD/TV
- **`serve` correctement listé en `dependencies`** (pas devDependencies) — pas de bug de déploiement
- **Aucune modification de DB en production**

---

### Problèmes détectés (non bloquants)

| # | Sévérité | Fichier | Problème |
|---|----------|---------|----------|
| 1 | Mineur/Sécurité | `TopBar.tsx:11`, `TopNav.tsx:24` | JWT passé en `?token=` dans l'URL — exposé brièvement dans les logs serveur et le champ Referer avant le `replaceState`. Pragmatique pour MVP cross-origin mais à documenter comme tradeoff connu. |
| 2 | Mineur/UI | `Sidebar.tsx:19` | Abréviation "IV" en mobile — ne correspond pas à "IPTVFlix", devrait être "IP" ou une icône. |
| 3 | Mineur/Tests | `live-tv-smoke.spec.ts:29` | Credentials `admin/admin` hardcodés — couplés à la seed de `DELETE /test/reset`. |
| 4 | Mineur/Doc | `nixpacks.toml` | Pas de documentation explicite sur la création du service Railway (env vars, root directory). |

---

### Décision

L'implémentation est solide, bornée au scope, et livrable. Les observations sont mineures et ne bloquent pas.

**IMPLEMENTATION_APPROVED**
