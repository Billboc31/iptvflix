Commit créé. Voici ce qui a été fait :

**Fichier modifié** : `runs/T080/diagnosis.md`

Transformations appliquées conformément à la review :

1. **Header ajouté** — Tableau "AI-Completed vs Human-Required Steps" en tête du document, avec statut explicite pour chaque étape.

2. **`<PENDING>` → `REQUIRES HUMAN EXECUTION`** dans les sections 1, 2, 3, 4, 5, 6, 7, 8 — chaque champ indique maintenant la commande exacte à exécuter (ex. `curl -v -H "User-Agent: iPhone..." /api/playback/stream/<sessionId>?compat=1` pour Section 5, `GET /api/diagnostics/env` pour Section 8, `node diagnose-stream.mjs` pour Sections 2/3/4/6).

3. **Section 9 Candidate 1 requalifié** : `ROOT CAUSE HYPOTHESIS — CONFIRMED FROM CODE, AWAITING PRODUCTION VERIFICATION` — la conclusion statique n'est plus présentée comme un diagnostic confirmé.

4. **Section "Handoff" ajoutée en fin** — 4 étapes humaines ordonnées avec les commandes exactes : déployer T080, appeler `/api/diagnostics/env`, exécuter `diagnose-stream.mjs` contre une URL Xtream réelle, tester iPhone Safari avec Web Inspector ouvert.
