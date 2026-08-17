# Media relay (Fly.io)

Relais HTTPS hors Railway : tire le flux Xtream depuis une IP non bloquée par Cloudflare,
et le ressert en HTTPS au navigateur (proxy MP4 ou remux HLS via ffmpeg).

## Pourquoi pas Railway ?

Les probes T087 montrent `HTTP 403` Cloudflare depuis Railway pour les bytes VOD.
L’API reste sur Railway ; seul le **média** passe par ce service.

## Déploiement Fly

```bash
# 1. Installer flyctl (macOS)
brew install flyctl
fly auth login

# 2. Depuis apps/media-relay
cd apps/media-relay
fly apps create iptvflix-media-relay   # si besoin ; adapter le nom dans fly.toml
fly secrets set MEDIA_RELAY_SECRET="$(openssl rand -hex 32)"
fly deploy
fly status
fly open /health
```

Note l’URL publique HTTPS, ex. `https://iptvflix-media-relay.fly.dev`.

## Brancher l’API (Railway)

Sur le service API :

```text
MEDIA_RELAY_URL=https://iptvflix-media-relay.fly.dev
MEDIA_RELAY_SECRET=<même secret que Fly>
```

Quand ces deux variables sont définies, `gatewayUrl` pointe vers
`{MEDIA_RELAY_URL}/v1/play?ticket=…` (ticket HMAC, credentials hors navigateur).

## Local

```bash
cd apps/media-relay
MEDIA_RELAY_SECRET=dev-secret pnpm dev
# API:
MEDIA_RELAY_URL=http://localhost:8080 MEDIA_RELAY_SECRET=dev-secret …
```

## Alternative

Un VPS (Hetzner, OVH, etc.) avec Docker + le même `Dockerfile` convient aussi ;
l’essentiel est une **IP hors datacenter Railway** et un certificat HTTPS.
