**183/183 tests passing.** Here's a summary of every file changed:

---

### Files created
| File | Purpose |
|---|---|
| `components/layout/TopNav.tsx` | Sticky horizontal nav — logo, 5 primary links (md+ only), desktop search input, mobile search button, settings link |
| `components/content/GenreChips.tsx` | Scrollable pill row — "Tous" chip + one per genre, accent colour on selected |
| `components/layout/TopNav.test.tsx` | 9 unit tests: links render, nav hidden on mobile (CSS class), search submit, profile link href |

### Files modified
| File | Change |
|---|---|
| `components/layout/AppShell.tsx` | Removed `LeftNav` + `TopBar`; now `flex-col` with `<TopNav />` at top |
| `components/content/HeroSection.tsx` | Added `availabilityStatus` + `onPlay` props; "Lire" button gated behind `AVAILABLE && onPlay`; "Détails" → "Plus d'infos"; hero height `56vh` → `65vh` |
| `components/content/HeroSection.test.tsx` | +4 tests: Play renders when AVAILABLE+onPlay, not when UNAVAILABLE, not when onPlay absent, callback fires on click |
| `pages/MoviesPage.tsx` | Rewritten: cinematic Hero → GenreChips → "Disponibles" + "Tous les films" shelves (or single genre shelf when selected) |
| `pages/SeriesPage.tsx` | Same structure as MoviesPage; no `onPlay` on hero (episode-driven playability) |
| `pages/MoviesPage.test.tsx` | Replaced FilterBar/PosterGrid/pagination tests with Hero, GenreChips, shelf, Play/no-Play, genre-filter tests |

### Files deleted
- `components/layout/LeftNav.tsx`
- `components/layout/TopBar.tsx`
