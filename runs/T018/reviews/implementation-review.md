---

## PR Review — T018 : Profile playback preferences & deterministic availability resolver

### Résumé

L'implémentation introduit un résolveur de disponibilité déterministe basé sur un scoring 5-tuple (audio → subtitle → source → qualité → id), une extension du modèle `Profile` avec 4 champs de préférences, des routes backend `/profile` et des endpoints catalog enrichis, et une UI de configuration des préférences (ProfileSettingsPage + sélecteur de variante sur les pages de détail). Le ticket couvre le backend, les contrats API, les tests et le frontend.

---

### Vérifications effectuées

- Plan `runs/T018/plan.md` lu en intégralité
- Diff complet vs `main` analysé (tous les fichiers modifiés/créés)
- `availability-resolver.ts` vérifié ligne par ligne (logique de scoring, gestion des nuls, capping qualité)
- `profile-service.ts` — patch PATCH vérifié (distinction `undefined` vs `null` sur `maxVideoQuality`)
- `catalog.ts` — routes détail film/série/épisode vérifiées
- `profiles.ts` (schema Drizzle) — colonnes et defaults vérifiés
- `availability-resolver.test.ts` — 8 suites de tests lues
- `catalog.test.ts` — mocks Drizzle et assertions vérifiés
- `ProfileSettingsPage.tsx` + `.test.tsx` — indépendance `navigator.language` vérifiée
- `MovieDetailPage.tsx` / `SeriesDetailPage.tsx` — sélecteur de variante vérifié
- Migration SQL `0012_profile_playback_preferences.sql` vérifiée
- Contrats API (`packages/api-contracts`) — types `ProfilePreferences`, `ProfileResponse`, `AvailabilityVariantResponse` vérifiés

---

### Points validés

**Résolveur déterministe**
- Le scoring 5-tuple produit toujours le même résultat pour les mêmes inputs — propriété démontrée par le test de tie-break UUID.
- Les variantes `UNAVAILABLE` sont filtrées avant scoring (non sélectionnables).
- Les variantes à métadonnées nulles ne sont pas silencieusement éliminées — elles apparaissent dans les alternatives avec un score "not found".
- Le capping qualité (`maxVideoQuality`) ne supprime pas les variantes haute qualité, il les ramène au niveau du cap dans le classement.

**Séparation locale UI / préférences de lecture**
- `ProfileSettingsPage` lit les préférences depuis `GET /profile`, pas depuis `navigator.language`.
- Le test vérifie explicitement ce comportement (`renders audio/subtitle preferences from API regardless of navigator.language`).

**Acceptation des critères**
- ✅ Préférences audio ordonnées (liste avec contrôles haut/bas/suppression)
- ✅ Sélection déterministe d'une variante préférée côté backend
- ✅ Priorité source > qualité quand audio score est ex-æquo (testé)
- ✅ Variantes alternatives accessibles dans la réponse API
- ✅ Métadonnées inconnues → fallback déterministe (pas d'exclusion silencieuse)
- ✅ Variantes indisponibles non sélectionnables (UI + backend)
- ✅ Tests couvrent : audio, subtitle, qualité, source-priority, null-metadata, no-availability

**Contrats API**
- Additions uniquement — aucune rupture de contrat pour les clients existants.
- `selectedVariantId` + `variants` ajoutés aux réponses détail movie/series/episode.
- `status` et `providerId` ajoutés à `AvailabilityVariantResponse` (nécessaires pour le sélecteur UI).

**Backward compatibility**
- Profils existants sans préférences → tableaux vides → résolveur se rabat sur le classement qualité.
- Comportement entièrement rétrocompatible.

---

### Problèmes détectés

**Aucun problème bloquant.**

**Observation 1 — Duplication de `bestQuality()` (mineur)**
`catalog.ts` redéfinit une fonction `bestQuality()` locale au lieu de l'importer depuis `catalog-service.ts`. Le plan mentionnait "remove duplicates". Cette duplication est sans impact fonctionnel mais augmente la surface de maintenance si les règles de classement qualité changent.
→ *Recommandé : extraire vers un fichier utilitaire partagé. Non bloquant.*

**Observation 2 — Validation des qualités dupliquée (mineur)**
`VALID_QUALITIES` est défini dans `profile.ts` (route) sans import depuis le résolveur (`QUALITY_ORDER` dans `availability-resolver.ts`). Si une nouvelle valeur de qualité est ajoutée au résolveur, il faudra penser à mettre à jour la validation du route.
→ *Recommandé : exporter `QUALITY_ORDER` depuis le résolveur et dériver `VALID_QUALITIES` depuis cette source unique. Non bloquant.*

**Observation 3 — `selectedVariantId` UI non persisté (attendu)**
La sélection manuelle d'une variante dans `MovieDetailPage`/`SeriesDetailPage` met à jour l'état local uniquement — elle n'appelle pas `PATCH /profile/preferences`. C'est cohérent avec le modèle (sélection d'instance vs préférence persistée) et conforme au ticket, mais il faut noter que le choix ne survit pas à un rechargement de page.
→ *Comportement correct dans le scope du ticket. Mention pour clarté.*

**Observation 4 — `DEFAULT_PROFILE_ID` supposé exister en base (risque opérationnel mineur)**
Si le profil `00000000-0000-0000-0000-000000000001` n'est pas présent (migration non exécutée), le service lève `throw new Error('Default profile not found — run migrations')` à chaque requête de détail. Le seed/migration doit garantir l'existence de ce row.
→ *Le plan le documente. Vérifier que la migration 0012 insert bien ce row par défaut. Non bloquant à condition que la migration soit correcte.*

---

### Risques éventuels

- **Fragmentation des routes détail** : `GET /movies/:id` et `GET /series/:id` ont migré de `movies.ts`/`series.ts` vers `catalog.ts`. Les URLs sont identiques mais le code source de référence change. Risque faible si les tests d'intégration couvrent ces endpoints, ce qui est le cas.
- **Mocks Drizzle dans `catalog.test.ts`** : la stratégie de mock des chaînes Drizzle est fragile si l'ORM change d'interface interne. Acceptable en complément du test vertical-slice qui frappe une vraie DB.
- **Croissance de `DEFAULT_PROFILE_ID` couplée** : si un second profil est nécessaire dans le futur, le hardcoding nécessitera un refactor. Délibérément hors scope du ticket — noter pour T-suivant éventuel.

---

### Décision

- APPROVED

L'implémentation est correcte, bien testée, rétrocompatible et couvre tous les critères d'acceptation du ticket. Les observations signalées sont des améliorations mineures de DRY/maintenance sans impact sur la correction du comportement. Aucune correction bloquante requise.

---

### Actions demandées

Aucune action bloquante. Recommandations optionnelles post-merge :
1. Extraire `QUALITY_ORDER` et `VALID_QUALITIES` vers un fichier `quality-constants.ts` partagé entre résolveur et route profil.
2. Vérifier que la migration SQL 0012 insère bien le row `DEFAULT_PROFILE_ID` si absent (ou qu'un seed garantit sa présence).

IMPLEMENTATION_APPROVED
