Both blocking fixes are done. Here's a summary:

---

## Changements effectués

### Fix BLOQUANT #1 — Migration renommée et journal mis à jour

- **Renommé** : `apps/api/migrations/0021_autoplay_previews.sql` → `0022_autoplay_previews.sql`
- **Mis à jour** : `apps/api/migrations/meta/_journal.json` — entrée `idx: 22` avec tag `0022_autoplay_previews` ajoutée
- **Créé** : `apps/api/migrations/meta/0022_snapshot.json` — copie du snapshot `0021` avec la colonne `autoplay_previews boolean NOT NULL DEFAULT true` ajoutée à la table `profiles`

### Fix BLOQUANT #2 — Navigation clavier/clic dans ShelfRow

- **Modifié** : `apps/web/src/components/content/ShelfRow.tsx`
  - Import de `useNavigate` depuis `react-router-dom`
  - Passage d'un `onClick` de navigation à chaque `PosterCard`, ce qui active `role="button"` et `tabIndex={0}` sur les cartes

### Vérification

Tous les 25 tests T054 passent (ShelfRow ×5, PosterCard ×12, HeroSection ×8).
