## Coder Attempt #4 — T090

**Situation** : cycle infini détecté. Le workflow tourne en boucle depuis la tentative #1. Aucun code ne reste à écrire.

---

### Diagnostic du cycle

Le reviewer émet correctement `IMPLEMENTATION_FIX_REQUIRED` **mais pas pour un bug de code** — pour une porte de validation humaine que seul Pierre peut franchir. `run_ticket.py` interprète ce statut comme "relancer le coder", ce qui crée une boucle infinie :

```
Reviewer → IMPLEMENTATION_FIX_REQUIRED (porte humaine manquante)
  └→ run_ticket.py → relance le Coder
       └→ Coder → rien à coder, signale la porte humaine
            └→ Reviewer → IMPLEMENTATION_FIX_REQUIRED (porte humaine manquante)
                 └→ (boucle)
```

### État du code

Complet et correct depuis la tentative #1. Vérifié indépendamment 3 fois :

| Couche | État |
|---|---|
| `media-prober.ts` — ffprobe duration extraction | ✓ |
| `api-contracts/playback.ts` — `durationSeconds: number \| null` | ✓ |
| `playback-resolver.ts` — logs avec `durationSeconds` | ✓ |
| `usePlayback.ts` — `probeDurationSeconds` | ✓ |
| `PlayerPage.tsx` — lock/reset sur hint | ✓ |
| `PlayerControls.tsx` — lock on first valid durationchange, 2 couches visuelles, état indéterminé | ✓ |
| `useProgressSync.ts` — 4 chemins stable duration | ✓ |
| Tests — 337 passent, incluant `stableDurationSeconds=7200 > video.duration=3600` | ✓ |

**Aucune modification de code n'est effectuée dans cette tentative #4.**

---

### Action requise — Pierre uniquement

Le ticket a une **completion rule explicite non-délégable** :

> *"Do not close from mocked `duration=3600` tests alone. Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position after closing/reopening."*

Pour débloquer le workflow, Pierre doit :

1. Lancer l'app avec un vrai film Xtream long (≥ 60 min)
2. Vérifier que la barre de progression n'augmente pas en total pendant le buffering
3. Fermer à ~25%, rouvrir, confirmer que la position de reprise est correcte
4. Créer `runs/T090/evidence-real-stream.md` avec un log excerpt ou screenshot
5. Relancer la review

**Alternativement**, si Pierre juge le ticket clôturable sur la base des tests automatiques seuls, il peut modifier manuellement `runs/T090/state.json` pour passer en `APPROVED` et bypasser la completion rule.

---

**Aucun fichier modifié.** Le workflow est bloqué sur une porte de validation humaine — ce n'est pas un problème de code.
