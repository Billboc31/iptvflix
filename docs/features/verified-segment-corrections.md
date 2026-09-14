# Corrections de repères vérifiées

Les repères communautaires restent la source par défaut. La table `verified_playback_segments` permet de corriger une édition après vérification visuelle. Une correction est liée à une disponibilité d’épisode précise et à sa durée mesurée, avec une tolérance maximale de 500 ms. Elle ne s’applique jamais aux autres sources ou sans durée connue.

Le web et Android transmettent `availabilityId` à `/episodes/:id/segments`. L’API vérifie l’appartenance de cette disponibilité à l’épisode et son état AVAILABLE. Les corrections vérifiées remplacent le même type de repère communautaire ; les autres segments restent inchangés. OUTRO et CREDITS sont considérés comme équivalents pour cette priorité.

La mise à jour quotidienne n’écrit pas dans cette table. Conserver une description de la vérification dans `evidence`. Revalider une correction si le fichier fournisseur change. Aucun décalage global ni réduction proportionnelle des temps n’est autorisé : des différences de montage pourraient couper une scène. Une absence de repères fiables reste une lecture normale.

Migration additive 0058. Les corrections sont ajoutées après revue par une opération SQL explicite ; aucun endpoint public de modification n’est exposé. Suppression de la disponibilité : suppression en cascade de ses corrections.
