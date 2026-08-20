Correction confirmée. Le playbook mentionne maintenant les bons numéros de migrations : `0047_t115_catalog_refresh_runs_type` et `0048_t115_enrichment_failures`.

**Seul changement effectué** : `runs/T115/production-run-playbook.md` — correction de la numérotation dans Pre-flight checklist et Step 1 (le `0046_t115_catalog_refresh_runs_type` et `0047_t115_enrichment_failures` incorrects remplacés par `0047` et `0048`).

Le reste de l'implémentation (33 tests, code, migrations) était déjà correct selon la review. Le seul blocage restant est opérationnel : executer le playbook contre la production avec `flyctl auth login` puis les commandes curl documentées dans le playbook.
