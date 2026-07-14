# AI Governance & Provisioning Portal

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kai-cloudflare/ai-control-plane-demo)

A single-page portal, running as a Cloudflare Worker, that demonstrates
**AI governance on top of Cloudflare AI Gateway** and then lets a visitor
**provision a live gateway on their own account** in about a minute.

It runs top to bottom in three steps:

1. **AI Portfolio Governance (Q&A).** A governance dashboard for a fictional
   company ("Northwind Retail"): sensitive-data leaks blocked, unsafe prompts
   stopped, policy coverage and risk, spend avoided, resilience, response
   quality, and agentic/MCP auditing. These are **sample figures** by default.
2. **Interactive product walkthrough.** A guided tour over pixel-accurate
   static snapshots of the **real** AI Gateway dashboard (logs, analytics,
   guardrails, dynamic routing), with an annotation overlay you can toggle off.
3. **Instant self-provisioning.** A guided wizard that creates a scoped API
   token, connects your Cloudflare account, deploys a live AI Gateway
   (`ai-control-plane-demo`) with caching, budget rate limits, and prompt
   logging, sends test traffic, and then flips Step 1 to show **your own live
   data** instead of the sample story.

Everything on display is a shipping
[Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/) feature.

## Run it locally

```
npm install
npm run dev
```

Open the URL wrangler prints (tested on `http://localhost:8788`).

For local development, create a `.dev.vars` (see `.dev.vars.example`):

```
DEPLOY_ENV=local
```

`DEPLOY_ENV=local` unlocks the temporary-account provisioning endpoints. These
are **disabled in production** on purpose (Cloudflare blocks preview-account
provisioning from its own network), so the "temporary sandbox" option only
appears when you run the portal on your own machine.

## Deploy

One click: use the **Deploy to Cloudflare** button above. It clones the repo
into your own GitHub/GitLab, provisions the Worker, wires up Workers Builds
(CI/CD), and deploys, no local setup required. The deployed instance runs in
production mode (`DEPLOY_ENV=production`), so the local-only temporary-sandbox
option stays disabled.

Or deploy from a local checkout:

```
npm run deploy
```

Add your own `routes` / `custom_domain` entries to `wrangler.jsonc` if you want
it on a specific hostname. The committed config is a clean template with no
account-specific routing.

## How Step 3 works

- **Scoped token.** The "Create scoped token" button deep-links to the
  Cloudflare dashboard with exactly the permissions the portal needs
  pre-selected: `AI Gateway: Read`, `AI Gateway: Edit`, `Workers AI: Read`,
  `Workers AI: Edit`. Token expiry cannot be pre-filled via the URL, so set a
  short expiry (e.g. 1 day) on the token screen if you want it to self-clean.
- **Token handling.** The token is kept **in memory only** for the browser tab.
  It is sent over HTTPS to run the actions you trigger, and is never written to
  disk, logged, or stored server-side. Close or reload the tab and it is gone.
  Running the portal locally means the token never leaves your machine.
- **What it calls.** Create/read/delete the AI Gateway and read its logs
  (AI Gateway Read+Edit); run a test inference through the gateway
  (Workers AI Read+Edit, both required per Cloudflare docs).

## Project layout

- `src/index.js` — Worker: serves the SPA and routes `/api/*`.
- `src/cf.js` — Cloudflare API client (gateway CRUD, logs, test inference,
  account resolution, readiness probe). `GATEWAY_ID = "ai-control-plane-demo"`.
- `src/pow.js` — temporary preview-account provisioning (local only).
- `src/data.js` — deterministic synthetic data for the Step 1 sample story.
- `public/index.html` — the three-step portal SPA (governance Q&A, walkthrough,
  provisioning wizard, data-source toggle).
- `public/overlay.js` / `public/overlay.css` — the Step 2 annotation overlay.
- `public/real/*.html` — the real-dashboard snapshots used as the Step 2 backdrop.

Key API routes (server-side): `/api/config`, `/api/connect`,
`/api/deploy-gateway`, `/api/test-gateway`, `/api/real-logs`, `/api/cleanup`,
plus the sample-data endpoints (`/api/governance`, `/api/overview`, `/api/logs`,
…) that drive Step 1's demo view.
