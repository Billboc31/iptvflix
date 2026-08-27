# PR Review — T138: Android TV Universal Live TV Search

## Résumé

L'implémentation couvre l'intégralité du périmètre du ticket : écran de recherche Android TV avec entrée texte et voix, trois sections de résultats (En direct maintenant / À venir / Chaînes), gestion de focus D-pad, identité visuelle dark+orange, intégration playback via PlaybackResolver, et 11 tests unitaires ViewModel. Un problème de correction fonctionnelle a été identifié sur l'affichage de l'heure locale dans la section "À venir".

---

## Vérifications effectuées

- Lecture du plan (`runs/T138/plan.md`) et de l'output d'implémentation (`runs/T138/implementation-output.md`)
- Code source : `LiveSearchViewModel.kt`, `LiveSearchScreen.kt`, `ChannelRepository.kt`, `ChannelApi.kt`, `ChannelModels.kt`, `AppNavGraph.kt`, `LiveTvHomeScreen.kt`
- Tests : `LiveSearchViewModelTest.kt`
- Croisement avec les acceptance criteria du ticket

---

## Points validés

### Architecture et scope
- ✅ Nouveau `LiveSearchViewModel` avec sealed state `Idle | Loading | Results | NoResults | Error`
- ✅ Debounce 400 ms via job cancellation (pas de coroutine externe)
- ✅ `onVoiceResult` délègue à `onQueryChanged` — même chemin de recherche que le texte
- ✅ `isSingleLiveNowResult` calculé à partir du state, safe car toute mutation de `_state` déclenche recomposition
- ✅ `ChannelRepository.searchLiveTV` propage les exceptions — le ViewModel gère l'état `Error`
- ✅ `ChannelApi.searchLiveTV` appelle `/channels/search?q=` (T137), URL-encodage correct
- ✅ Nouveaux modèles `LiveNowResult`, `UpcomingResult`, `ChannelSearchResult`, `LiveSearchResponse` — tous `@Serializable`, pas de champ obligatoire manquant

### Écran de recherche
- ✅ Fond dark (`TvColors.Background`), accent orange (`TvColors.LiveTvAccent`) partout
- ✅ `BasicTextField` avec underline orange au focus (3 dp), placeholder, curseur orange
- ✅ Bouton microphone conditionnel : vérifié via `PackageManager.resolveActivity(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)` — absent sur les appareils sans recognizer
- ✅ Résultat vocal injecté dans le champ texte (`query = text`) et transmis au ViewModel (`onVoiceResult`)
- ✅ Section "En direct maintenant" : logo, nom chaîne, titre programme, badge `EN DIRECT` / `Lancer · EN DIRECT`, barre de progression, heure début-fin
- ✅ Single live result : auto-focus sur le premier item, label "Lancer · EN DIRECT" → un seul appui OK pour lancer. Pas de lancement auto minuté
- ✅ Multiple live results : liste, pas de sélection automatique
- ✅ Section "À venir" : `onClick = {}` — sélectionner un item ne lance pas le playback
- ✅ Section "Chaînes" : logo + nom + catégorie optionnelle
- ✅ États vides distincts : `"Aucun programme trouvé"` (NoResults) vs `"Erreur de recherche"` + Réessayer focusable (Error)
- ✅ Focus initial sur la search bar ; focus sur le premier item du premier groupe non vide après résultats ; retour sur la search bar après `clearQuery`
- ✅ `BackHandler` → `LiveTvHome`

### Navigation et playback
- ✅ `LiveTvSearch` ajouté au `Screen` enum
- ✅ Bouton "⌕ Rechercher" dans le header de `LiveTvHomeScreen`, D-pad accessible, focus orange 3 dp
- ✅ `onLiveNowSelected` et `onChannelSelected` construisent un `PlaybackCommand(mediaType = "channel", mediaId = channelId, …)` → `commandVm.playLocal()` → `Screen.Player` — même pattern que `LiveTvHome`
- ✅ Pas de modification du Player, du Zapper ou du `PlaybackResolver`
- ✅ Pas de duplication source-level (délégué au backend T137, côté Android un item = un `channelId`)

### Tests
- ✅ 11 tests JUnit 4 + MockK + `UnconfinedTestDispatcher` couvrant tous les scénarios du plan :
  - Recherche par nom de chaîne, résultat live, résultat futur uniquement
  - Plusieurs résultats live / un seul résultat live (`isSingleLiveNowResult`)
  - `onVoiceResult` → même état que `onQueryChanged`
  - `clearQuery` → `Idle`, aucun appel API sur requête vide
  - Erreur API → `Error`
  - Comportement sans EPG → `channels` rempli

---

## Problèmes détectés

### 🔴 BLOQUANT — Heure UTC affichée au lieu de l'heure locale (section "À venir")

**Fichier** : `LiveSearchScreen.kt`, lignes 725–733

```kotlin
private fun formatIsoTime(isoTime: String): String =
    isoTime.substringAfter('T', isoTime).take(5)

private fun formatIsoDateShort(isoTime: String): String {
    val date = isoTime.substringBefore('T', isoTime)
    val parts = date.split('-')
    return if (parts.size == 3) "${parts[2]}/${parts[1]}" else date
}
```

Ces fonctions extraient la composante horaire brute de la chaîne ISO-8601 sans conversion de timezone. Les fixtures de test utilisent le suffixe `Z` (UTC) — `"2026-08-27T21:00:00Z"` → affiché `"21:00"`. Pour un utilisateur en France (UTC+2 en été), l'heure correcte serait `"23:00"`.

Le ticket exige explicitement **"date + local time prominently"** pour la section "À venir". Afficher l'heure UTC sur un appareil configuré en Europe/Paris est une erreur fonctionnelle directe : l'utilisateur saurait pas à quelle heure regarder.

Le même problème affecte les heures début-fin de `LiveNowRow`, mais c'est moins critique car l'information principale est le badge EN DIRECT.

**Correction attendue** :

```kotlin
private fun formatIsoTime(isoTime: String): String = try {
    val zdt = java.time.ZonedDateTime.parse(isoTime)
    val local = zdt.withZoneSameInstant(java.time.ZoneId.systemDefault())
    String.format("%02d:%02d", local.hour, local.minute)
} catch (_: Exception) {
    isoTime.substringAfter('T', isoTime).take(5)
}

private fun formatIsoDateShort(isoTime: String): String = try {
    val zdt = java.time.ZonedDateTime.parse(isoTime)
    val local = zdt.withZoneSameInstant(java.time.ZoneId.systemDefault())
    String.format("%02d/%02d", local.dayOfMonth, local.monthValue)
} catch (_: Exception) {
    val date = isoTime.substringBefore('T', isoTime)
    val parts = date.split('-')
    if (parts.size == 3) "${parts[2]}/${parts[1]}" else date
}
```

`java.time` est disponible nativement sur API 26+ (cible Android TV).

---

## Risques éventuels

### 🟡 MINEUR — `@Suppress("DEPRECATION")` sur `resolveActivity`

`PackageManager.resolveActivity(Intent, Int)` est deprecated en API 33+. Acceptable pour l'instant, mais devrait utiliser `resolveActivity(Intent, ResolveInfoFlags)` avec check API level lors d'une prochaine passe.

### 🟡 MINEUR — `streamUrl` / `deliveryMode` dans `LiveNowResult` inutilisés côté Android

Ces champs sont présents dans le modèle (retournés par le backend) mais non consommés — le playback passe exclusivement par `channelId` → `PlaybackResolver`. Cohérent avec le plan, pas bloquant.

### 🟡 MINEUR — Pas d'étiquette relative ("ce soir", "demain")

Le plan l'indique explicitement comme optionnel. Non bloquant.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[REQUIS]** Corriger `formatIsoTime` et `formatIsoDateShort` dans `LiveSearchScreen.kt` pour convertir l'heure UTC en heure locale de l'appareil via `java.time.ZonedDateTime` + `ZoneId.systemDefault()`. Appliquer la correction à toutes les occurrences de ces fonctions (section "À venir" et section "En direct maintenant").

2. **[OPTIONNEL]** Ajouter un test unitaire de la fonction de formatage si elle est extractée en utilitaire (valider UTC → heure locale sur une fixture connue).

IMPLEMENTATION_FIX_REQUIRED
