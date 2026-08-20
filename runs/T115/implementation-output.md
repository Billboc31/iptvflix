**Situation claire** : l'implémentation T115 est complète (33/33 tests, code et migrations corrects). Il n'y a aucun changement de code à faire.

Le seul blocage est la **Completion Rule** du ticket, qui requiert une intervention humaine :

```
Completion rule: Do not close after unit tests. Run the new enrichment mode against
production (or an equivalent restored production snapshot), publish before/after
counts, and show the remaining terminal failures with their real causes.
```

## Action requise — toi

Le playbook `runs/T115/production-run-playbook.md` détaille exactement les étapes. En résumé :

**Pré-requis**
- Accès Fly.io : `flyctl auth login`
- `ADMIN_PASSWORD` et `DATABASE_URL` disponibles

**Étapes**
1. Vérifier que les migrations `0047` et `0048` sont appliquées en production
2. Capturer les stats avant : `GET /admin/catalog-stats`
3. Lancer l'enrich-missing : `POST /admin/catalog-enrich-missing`
4. Relancer les 126 failures connues : `POST /admin/catalog-enrich-missing/retry-failures`
5. Attendre la complétion (`status: "COMPLETED"`)
6. Capturer les stats après et la liste des failures avec leurs vraies causes
7. Créer `runs/T115/production-run-20260820.md` avec le rapport

Une fois ce fichier commité sur la branche, la review suivante pourra approuver immédiatement — aucune correction de code n'est attendue.

Veux-tu que je t'aide à préparer autre chose, ou as-tu besoin de clarifications sur les commandes du playbook ?
