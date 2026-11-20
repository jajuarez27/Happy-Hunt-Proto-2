# Happy Hunt API

Local Node/Express backend that proxies Supabase using the **service role key**
(server-side only) and serves the static web client in `../public`.

## Prerequisites

- Node.js 20+ and npm
- A `.env` file in the repo root (copy `.env.example` and fill in values)

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase project URL, e.g. `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role key — **server only, never ship to the browser** |
| `SUPABASE_ANON_KEY` | no | Present for reference/client use; not used by this server |
| `PORT` | no | API port (default `3000`) |

## Run locally

```bash
cd api
npm install
npm start        # or: npm run dev (auto-restart)
```

The server listens on `http://localhost:3000` and serves both the API and the
frontend (`http://localhost:3000`).

## Routes

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/restaurants?cuisine=&location_id=&q=` | List restaurants (optional filters) |
| GET | `/api/restaurants/:id` | Restaurant detail incl. happy hours and deals |
| GET | `/api/saved-places?user_id=` | List a user's saved places |
| POST | `/api/saved-places` | Save a place `{ user_id, restaurant_id }` (201; 409 on duplicate) |

Full spec: `openapi.yaml`.

## Smoke tests

```bash
BASE_URL=http://localhost:3000 bash ../tests/smoke.sh
```

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` bypasses Row Level Security — it lives only in
  `.env` (gitignored) and `api/server.js`.
- The browser client in `public/` calls only the local API; it contains no
  Supabase keys.
