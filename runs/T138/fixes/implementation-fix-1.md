# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T138/reviews/implementation-review.md
- generated at: 2026-08-27T14:45:59Z

---

I now have a complete picture of the implementation. Let me compile the review.

---

## Review — T138 Android TV Universal Live Search

### Périmètre couvert

L'implémentation couvre l'ensemble des exigences fonctionnelles du ticket :

- `LiveSearchViewModel.kt` — sealed state correct (`Idle | Loading | Results | NoResults | Error`), debounce 400 ms via job cancellation, `onVoiceResult` réentrant sur `onQueryChanged`, `isSingleLiveNowResult` dérivé proprement depuis le state.
- `LiveSearchScreen.kt` — composable complet : barre de recherche avec orange focus underline, bouton micro conditionnel via `RecognizerIntent` + `PackageManager.resolveActivity`, trois sections résultats dans un `TvLazyColumn`, focus D-pad déterministe sur le premier item de la première section non-vide, états idle/loading/error/no-results.
- `ChannelRepository.kt` — ajout minimal de `searchLiveTV` propageant les exceptions, conforme au plan.
- `AppNavGraph.kt` — `LiveTvSearch` dans l'enum, câblage `onOpenSearch` / `onChannelSelected` / `onLiveNowSelected` conforme au pattern existant.
- `LiveTvHomeScreen.kt` — paramètre `onOpenSearch` ajouté, bouton "Rechercher" D-pad accessible.
- `LiveSearchViewModelTest.kt` — 11 tests couvrant tous les scénarios du plan.

### Problème bloquant (non corrigé depuis la première review)

**`LiveSearchScreen.kt:725-733` — Affichage de l'heure UTC sans conversion timezone**

```kotlin
// ISO-8601 "2026-08-27T20:30:00Z" → "20:30"
private fun formatIsoTime(isoTime: String): String =
    isoTime.substringAfter('T', isoTime).take(5)

// ISO-8601 "2026-08-27T20:30:00Z" → "27/08"
private fun formatIsoDateShort(isoTime: String): String {
    val date = isoTime.substringBefore('T', isoTime)
    val parts = date.split('-')
    return if (parts.size == 3) "${parts[2]}/${parts[1]}" else date
}
```

Le backend retourne des timestamps UTC (suffixe `Z`, confirmé par les fixtures de test : `"2026-08-27T21:00:00Z"`). Ces deux fonctions extraient la composante temporelle brute sans convertir vers la timezone locale du device. Pour un utilisateur en France (UTC+2 en été), `"21:00Z"` s'affiche `"21:00"` au lieu de `"23:00"`.

Le ticket exige explicitement **"date + local time prominently"** dans la section "À venir". Ce bug est une violation fonctionnelle directe de cette exigence.

`formatIsoTime` est utilisé également dans `LiveNowRow` (ligne 506) pour afficher les horaires start/end — même défaut, même correctif requis.

**Correction attendue :**

```kotlin
import java.time.ZonedDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private fun formatIsoTime(isoTime: String): String = runCatching {
    ZonedDateTime.parse(isoTime)
        .withZoneSameInstant(ZoneId.systemDefault())
        .format(DateTimeFormatter.ofPattern("HH:mm"))
}.getOrElse { isoTime.substringAfter('T', isoTime).take(5) }

private fun formatIsoDateShort(isoTime: String): String = runCatching {
    val local = ZonedDateTime.parse(isoTime).withZoneSameInstant(ZoneId.systemDefault())
    "${local.dayOfMonth.toString().padStart(2, '0')}/${local.monthValue.toString().padStart(2, '0')}"
}.getOrElse {
    val date = isoTime.substringBefore('T', isoTime)
    val parts = date.split('-')
    if (parts.size == 3) "${parts[2]}/${parts[1]}" else date
}
```

`java.time.ZonedDateTime` est disponible depuis API 26 (minimum supporté par les projets Android TV modernes) — pas de dépendance nouvelle requise.

### Observations mineures (non bloquantes)

- **Tests de formatage absents** : aucun test unitaire ne vérifie `formatIsoTime`. Après correction, un test de conversion timezone (ex. UTC `"21:00Z"` → `"23:00"` en UTC+2) renforcerait la confiance, mais ce n'est pas dans le scope défini du plan.
- **`@Suppress("DEPRECATION")` sur `resolveActivity`** : correct pour la compatibilité pre-API 33, annotation appropriée.
- **`UpcomingRow` focusable sans affordance textuelle** : le focus border orange s'affiche (correct), mais l'absence de toute action sur OK n'est pas communiquée à l'utilisateur. Acceptable pour ce ticket (reminder stub = no-op), mais à noter pour l'évolution future.

### Verdict

Le problème bloquant de la première review (**formatage d'heure UTC sans conversion locale**) n'a **pas été corrigé**. L'implémentation ne peut pas être approuvée en l'état.

IMPLEMENTATION_FIX_REQUIRED
