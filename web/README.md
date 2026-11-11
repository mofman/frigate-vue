This is the Frigate frontend: a Vue 3 + TypeScript app built with Vite and
styled with plain, scoped, modern CSS.

# Web Development

## Installing Web Dependencies Via NPM

Within `/web`, run:

```bash
npm install
```

## Running development frontend

Within `/web`, run:

```bash
PROXY_HOST=<ip_address:port> npm run dev
```

The Proxy Host can point to your existing Frigate instance on its internal,
unauthenticated port (5000). Otherwise it defaults to `localhost:5000` if
running Frigate on the same machine. On macOS, port 5000 is taken by the
AirPlay receiver, so point at the Frigate host explicitly.

## Checks

```bash
npm run typecheck      # vue-tsc
npm run lint           # eslint + i18n key check
npm run test:run       # vitest unit tests
npm run e2e:build && npm run e2e   # playwright, desktop and mobile
```

The playback e2e tests generate small H.264 fixtures with `ffmpeg` and are
skipped when it is not installed.

## Layout

| Path | Purpose |
| --- | --- |
| `src/styles/tokens.css` | Design tokens, the only place colors are defined |
| `src/components/` | Reusable components, each with scoped CSS |
| `src/views/` | Route components |
| `src/players/` | Live (MSE, WebRTC, jsmpeg) and recorded (HLS) playback |
| `src/api/` | fetch wrapper, query cache and websocket |
| `src/composables/` | Shared reactive logic |

See `TODO.md` for the roadmap.

## Extensions

Install these IDE extensions for an improved development experience:

- eslint
- Vue - Official (Volar)
