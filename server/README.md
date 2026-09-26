# Myths and Legends online server

A small WebSocket server that puts players in rooms by a four-letter code and
passes each player's moves on to the others. The fight itself runs in every
player's game (see `src/net/` in the game): each player drives their own hero,
and the room's host keeps the monsters for everyone. Co-op rooms hold up to 4
players; duel rooms (the Floating Island) hold 2.

## Run it locally

```sh
cd server
npm install
npm start              # listens on port 8080 (PORT to change it)
```

Then start the game against it from the repo root:

```sh
VITE_MP_SERVER=ws://localhost:8080 npm run dev
```

## Deploy on Render (free, no card needed)

1. Sign in at https://dashboard.render.com with GitHub.
2. New > Blueprint, pick the Pixel-Game repository, then Apply. Render reads
   `render.yaml` at the repo root and starts the server.
3. Copy the service's URL (like `https://myths-and-legends-server.onrender.com`)
   and put it in `DEPLOYED` in `src/net/config.ts` (or set `VITE_MP_SERVER`
   on Vercel).

The free plan sleeps after 15 minutes without players; the first player to
connect after that waits up to a minute while it wakes (the game says so).
It redeploys by itself only when something under `server/` changes.

## Or on Fly.io

From this folder: `fly launch --copy-config --no-deploy` once, then
`fly deploy`. The URL is `https://<app>.fly.dev`.

## Health check

`GET /health` answers `ok`.
