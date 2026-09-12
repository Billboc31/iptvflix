# Never Stop — web et Android TV

Implémentation locale du 12 septembre 2026, sur `codex/never-stop`.
Base : `b016cdd693a3794e47a0b9777acfc7fe07039a61`.

## Fonctionnement

Les préférences existantes du profil contrôlent la lecture : `autoSkipIntro`, `autoSkipRecap`, `autoplayNextEpisode`, `neverStopMode`. Never Stop active le saut des introductions, récapitulatifs, génériques et annonces du prochain épisode, puis l’enchaînement automatique. Le prochain épisode commence à zéro, même s’il possède une progression antérieure. Un bref texte en haut annonce l’épisode. Un interrupteur est disponible dans les commandes web et Android TV ; les options individuelles sont disponibles dans les réglages du profil web.

Un repère non vérifié reste manuel. Sans données, la lecture continue normalement. Une scène située entre la fin du générique et la fin réelle de l’épisode est conservée lorsque les repères la distinguent. Aucune durée de générique arbitraire n’est utilisée. Le changement automatique ne saute pas un épisode indisponible ou un trou de numérotation. Il peut traverser une frontière entre deux saisons consécutives.

## Architecture

- API Fastify : enrichissement de `GET /episodes/:id/segments?durationSeconds=...`, à partir de l’épisode canonique, de ses identifiants TMDB/IMDb et de sa saison. Aucune migration DB.
- Contrat partagé : `autoSkipSafe`, `source`, `sourceUrl`, champs optionnels pour compatibilité avec les anciens clients.
- Service `playback-segments.ts` : requêtes publiques, délai de cinq secondes par requête, cache de résultats une heure, cache négatif cinq minutes, déduplication des demandes concurrentes, maximum vingt recherches simultanées. Budget de cent requêtes/minute/hôte/processus ; ce budget n’est pas distribué entre plusieurs instances.
- Web : `useEpisodeSegments`, `useNeverStop`, `useEpisodeNavigation`, branchement dans `PlayerPage`, commandes et préférences. Protection contre une réponse de résolution vidéo devenue obsolète.
- Android : ExoPlayer, `SegmentsApi`, politique pure `SkipPolicy`, `PlayerViewModel`, commandes Compose. Chargement des métadonnées indépendant du démarrage du lecteur. Les repères commencent à `startMs`, contrairement à l’ancien bouton visible depuis zéro.
- Les anciennes sélections DB servent de repli manuel. Les fournisseurs existants de synchronisation de segments ne sont pas modifiés.

## Sources et correspondance

1. [AniSkip API](https://api.aniskip.com/api-docs), [projet](https://github.com/aniskip/aniskip-api) : `/v2/skip-times/{malId}/{episode}` avec `op`, `ed`, `recap`. Secondes converties en millisecondes. Les types mélangés à du contenu narratif sont exclus. Une durée à ±2 secondes et un repère non ambigu sont nécessaires au saut automatique.
2. [Fribb anime-lists](https://github.com/Fribb/anime-lists) : correspondance TMDB → MyAnimeList, saisons et offsets explicites. À défaut, une unique correspondance de série complète et une numérotation absolue calculable sont nécessaires. Pas de rapprochement approximatif par titre. Le fichier distant est mis en cache 24 heures.
3. [SkipDB](https://skipdb.tv/docs) : IMDb/saison/épisode et durée, `adjust=none`. Seuls `match=exact` et une confiance ≥0,8 autorisent l’automatique. Les réponses contradictoires entre sources sont rétrogradées en manuel. Données sous ODbL 1.0 avec clause de réciprocité indiquée par le fournisseur ; conserver attribution et respecter ses conditions lors de la mise en service. Aucune soumission de données ni création de compte n’a été effectuée.

Seuls les identifiants publics du contenu et la durée sont envoyés aux services externes. Aucun identifiant de compte IPTVFlix, token ou URL du fournisseur vidéo.

Désactivation opérationnelle : `PLAYBACK_SEGMENTS_ENABLED=false` sur l’API coupe les recherches externes et conserve le repli catalogue manuel.

## Validation locale

- Web : contrôle TypeScript réussi ; build Vite réussi ; 22 tests ciblés réussis (lecteur existant, politique de saut et navigation entre saisons).
- API : contrôle TypeScript du code de production réussi ; 11 tests ciblés réussis (route et fournisseur).
- Android : compilation Kotlin réussie ; 105 tests unitaires réussis, dont trois nouveaux tests de politique de saut.
- Requêtes publiques de vérification : AniSkip pour One Piece épisode 1, HTTP 200 avec trois repères ; SkipDB pour Breaking Bad S01E01, HTTP 200 avec les quatre clés attendues. Cela vérifie l’accessibilité et le format, pas l’alignement avec les fichiers IPTV du projet.
- Le contrôle TypeScript global de l’API reste bloqué par des fixtures existantes hors périmètre (notamment accountId, qualityPrior, languageAffinity et types de candidats). Le contrôle de production, excluant ces tests, passe.
- La copie Git initiale ne compilait pas Android : `EpgFormat.kt` et `LiveSearchUi.kt`, présents dans le dossier original mais non dans le commit cloné, ont été récupérés à l’identique ; un test incomplet de libellé de source a été réparé. Ces prérequis font l’objet d’un commit distinct.

Commandes exécutées :

```sh
pnpm --filter @iptvflix/web typecheck
pnpm --filter @iptvflix/web exec vite build
pnpm --filter @iptvflix/web exec vitest run src/hooks/useNeverStop.test.ts src/hooks/useEpisodeNavigation.test.ts src/pages/PlayerPage.test.tsx
pnpm --filter @iptvflix/api exec tsc -p tsconfig.build.json --noEmit
pnpm --filter @iptvflix/api exec vitest run src/routes/__tests__/episodes-segments.test.ts src/services/playback-segments.test.ts
# Depuis apps/android-tv, avec JDK 21 et SDK Android disponibles :
./gradlew :app:compileDebugKotlin :app:testDebugUnitTest --offline --no-daemon -Pkotlin.compiler.execution.strategy=in-process
```

## Limites et recette avant production

Cette version automatise les coupes et le changement d’épisode ; elle ne garantit pas une transition audiovisuelle sans chargement. Elle ne préouvre pas un second flux IPTV. Le résolveur et le fournisseur vidéo peuvent introduire une attente. Les versions doublées, remontées ou avec logos différents peuvent avoir des repères différents ; une durée concordante ne prouve pas à elle seule l’identité du montage. Les données communautaires ne couvrent pas tous les épisodes ni tous les récapitulatifs.

Web : le saut attend que sa destination soit dans la plage réellement seekable. Un remux non encore disponible à cette position ne sera pas forcé. Pour un remux, seule la durée de sonde complète sert à vérifier les données et à autoriser l’avance en fin d’épisode. Android : le saut est activé sur les flux VOD DIRECT, avec durée et navigation temporelle disponibles ; les timelines de remux restent exclues de cette première implémentation.

Pas de test visuel sur appareil physique ni de lecture réelle avec le nouveau backend ; aucun déploiement, aucune installation d’APK, aucune modification de la base de production. Avant mise en service, vérifier en environnement de recette avec une source connue : introduction, recap, ending avec scène après générique, absence de repères, variante de durée différente, passage de saison, dernier épisode, pause, déplacement manuel et coupure réseau. Vérifier également focus télécommande, sous-titres, audio et temps de transition.

Le projet original `/Users/pierrebocquet/iptvflix` n’a pas été modifié. Aucun ticket GitHub créé, aucun push ni message envoyé à une autre conversation.

## Déploiement et remplissage persistant (extension du 12 septembre)

Ajout de la migration additive `0057_playback_segment_cache` : réponses publiques mises en cache 24 h et résultat de couverture par film/épisode, avec date de contrôle et date de prochaine tentative. Les erreurs conservent les segments connus et sont réessayées après une heure ; succès et absences de repères après 24 h. Le traitement démarre automatiquement avec l’API, reprend après redémarrage et utilise un verrou PostgreSQL contre les doublons entre instances. Il fonctionne indépendamment de la synchronisation des sources IPTV ; les nouveaux titres sont découverts automatiquement.

Le catalogue de production est volumineux : environ 61 923 films et 1 141 276 épisodes lors du contrôle initial. Le remplissage exploite donc l’export public de SkipDB (`https://skipdb.tv/api/dump`, 102 137 entrées lors du contrôle), indexé par IMDb/saison/épisode. Les identifiants IMDb déjà présents dans `external_ids` sont réutilisés ; il n’est pas nécessaire de reconstituer toute la métadonnée TMDB. AniSkip utilise un index TMDB→MAL et son résultat complet par épisode, conservant les variantes de durée avant sélection lors du visionnage. Les requêtes réseau individuelles sont espacées ; les correspondances en mémoire ne sont pas artificiellement ralenties.

Le remplissage parcourt l’ensemble du catalogue de façon progressive, par lots. La cadence de contrôle est de 24 h après chaque titre traité, et non une promesse de terminer 1,2 million de titres à une heure fixe. Le premier passage peut durer longtemps selon la couverture AniSkip et la charge serveur. Les repères génériques stockés ne sont pas automatiquement déclarés sûrs : la durée réelle reste vérifiée pendant la lecture.

Nouveaux endpoints : `GET /movies/:id/segments`, et `GET /admin/segments/catalog-status` authentifié pour les totaux, erreurs et dates de traitement. Les films disposent de repères manuels sur le web et Android. Never Stop et l’enchaînement restent des fonctions du lecteur d’épisodes.

Variables opérationnelles : `PLAYBACK_SEGMENT_CATALOG_ENABLED=false` arrête le remplissage, sans couper les recherches à la demande ; `PLAYBACK_SEGMENTS_ENABLED=false` coupe les recherches externes et le remplissage. Aucun appel de probe vidéo de masse, aucune suppression de catalogue ni réécriture de progression utilisateur.
