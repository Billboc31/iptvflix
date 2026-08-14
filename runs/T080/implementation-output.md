## Summary — Coder Attempt 4

**Ce que cette tentative apporte** que les 3 précédentes n'ont pas fait :

Un script de diagnostic local (`apps/api/scripts/diagnose-stream.mjs`) qui reproduit exactement le pipeline de production, permettant de remplir **4 des 9 sections `<PENDING>`** sans déploiement Railway ni iPhone Safari.

### Fichiers modifiés

| Fichier | Action |
|---|---|
| `apps/api/scripts/diagnose-stream.mjs` | Créé |
| `runs/T080/diagnosis.md` | Mis à jour (sections 2/3/4/6) |
| `runs/T080/implementation-output.md` | Mis à jour |

### Ce que le script fait (en miroir exact du code de production)

- **Section 2** — `ffprobe <URL>` (même invocation que `probeMedia()`) → container, codecs, résolution, framerate
- **Section 3** — `classifyDelivery(isSafari=true)` inline → mode sélectionné et pourquoi
- **Section 4** — `fetch(url) → Readable.fromWeb → pipe → ffmpeg stdin` (identique à `runFfmpegStream()`) → `exitCode`, `stderrTail`, `msToFirstByte`, premiers octets hex
- **Section 6** — `ffprobe output.mp4` → confirme si le fMP4 produit est valide

Usage :
```bash
node apps/api/scripts/diagnose-stream.mjs --url '<XTREAM_URL>' --ext ts
```

### Sections toujours `<PENDING>` (nécessitent action humaine)

| Section | Requiert |
|---|---|
| 1 — Trace session | App en cours + lecture réelle |
| 5 — Réponse HTTP Safari | Requête depuis Safari ou curl |
| 7 — Safari MediaError | iPhone + Web Inspector |
| 8 — Railway runtime | Déploiement + `/api/diagnostics/env` |
