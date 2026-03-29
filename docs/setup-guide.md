# Agent Hub Setup Guide

Get the Agent Hub running with your own Pipedrive account.

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A Pipedrive account (free trial works)

## 1. Create a Pipedrive Custom App

1. Go to [Pipedrive Developer Hub](https://developers.pipedrive.com/)
2. Click **Create an app** → select **Custom App**
3. Set the **OAuth redirect URI** to your callback URL:
   - Local: `http://localhost:3001/auth/callback`
   - Production: `https://your-railway-url.up.railway.app/auth/callback`
4. Under **OAuth & access scopes**, enable:
   - `leads:full`
   - `deals:full`
   - `persons:full`
   - `organizations:full`
   - `activities:read`
   - `users:read`
   - `notes:full`
5. Save and note the **Client ID** and **Client Secret**

## 2. Set Up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database** and note the connection string
3. Run the migrations:

```bash
supabase db push
```

4. Note your **Project URL**, **anon key**, and **service role key** from Settings → API

## 3. Get API Keys

- **Anthropic (Claude):** Get an API key at [console.anthropic.com](https://console.anthropic.com)
- **Tavily (optional):** Free API key at [tavily.com](https://tavily.com) — enables web search for the Lead Qualification agent's research step

## 4. Configure Environment

```bash
cp .env.example .env
```

Fill in all values in `.env`:

| Variable | Where to find it |
|----------|-----------------|
| `ANTHROPIC_API_KEY` | Anthropic Console |
| `PIPEDRIVE_CLIENT_ID` | Pipedrive Developer Hub |
| `PIPEDRIVE_CLIENT_SECRET` | Pipedrive Developer Hub |
| `PIPEDRIVE_REDIRECT_URI` | Your callback URL |
| `SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_URL` | Same as SUPABASE_URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API |
| `PG_HOST` | Supabase Dashboard → Settings → Database (host) |
| `PG_USER` | Supabase Dashboard → Settings → Database (user) |
| `PG_PASSWORD` | Supabase Dashboard → Settings → Database (password) |
| `PG_DATABASE` | `postgres` (default) |
| `JWT_SECRET` | Any random string (e.g., `openssl rand -hex 32`) |
| `TAVILY_API_KEY` | Tavily dashboard (optional) |

The `PG_*` variables are used for the LangGraph checkpoint store. Use the **connection pooler** credentials from Supabase (port 6543) for better reliability on the free tier.

## 5. Run Locally

```bash
pnpm install
pnpm dev
```

This starts:
- Server on `http://localhost:3001`
- Web dev server on `http://localhost:5173`

Open `http://localhost:5173` and click **Connect with Pipedrive** to authorize.

## 6. Deploy to Railway

1. Push to GitHub
2. Create a new project on [Railway](https://railway.app)
3. Connect your GitHub repo
4. Add all environment variables from `.env`
5. Railway auto-detects the Dockerfile and deploys

The server serves both the API and the SPA from one container.

Set `PIPEDRIVE_REDIRECT_URI` and `PUBLIC_SERVER_URL` to your Railway URL.
