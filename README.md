# AI Control Plane &mdash; Instant Demo

A one-click Cloudflare demo. Click **Deploy to Cloudflare**, paste a scoped API token (it goes straight into **Cloudflare Secrets Store**), and you get a live website that provisions a real **AI Gateway** and a real **MCP Server Portal** (with sample MCP servers) on your own account. Everything is reversible with one button.

The point: a prospect should finish this in five minutes and feel like they can keep building from here.

## Deploy

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kai-cloudflare/ai-control-plane-demo)

During the deploy flow Cloudflare will:

1. Clone this repo into your own GitHub and set up CI/CD.
2. Provision the KV namespace used for demo state.
3. Prompt you for the **`CF_API_TOKEN`** secret and store it in **Secrets Store** (open beta, one store per account).

## The API token

Create it at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) &rarr; **Create Token** &rarr; **Custom Token**, scoped to your account:

- **AI Gateway**: Edit
- **Zero Trust**: Edit
- **Access: Apps and Policies**: Edit
- **Account Settings**: Read

Set a short TTL and delete it after the demo. The token is entered in the trusted Cloudflare deploy flow, stored in Secrets Store, and read by the Worker via `await env.CF_API_TOKEN.get()`. It is never typed into this app, transmitted to it, written to code or KV, or shown on the page. That is the whole security story: the demo app cannot see your token.

## What it builds

- **AI Gateway** (`ai-control-plane-demo`): caching, rate limiting, logging. The site shows the gateway endpoint and a ready-to-run curl.
- **MCP Server Portal** (`ai-control-plane-demo-portal`) with two sample MCP servers (the public, unauthenticated Cloudflare Docs MCP server, plus a replace-me placeholder), so the customer sees governed MCP access behind Cloudflare Access.

## How it works

```
Browser ──→ Worker (this app) ──→ Cloudflare REST API
                │                      ├─ POST /ai-gateway/gateways
                │                      └─ POST /access/ai-controls/mcp/{servers,portals}
                └── reads token from ── Secrets Store binding (CF_API_TOKEN)
```

- `src/index.ts` &mdash; router: serves the site and the `/api/*` actions.
- `src/cf.ts` &mdash; Cloudflare API client and the create/delete steps (idempotent).
- `src/html.ts` &mdash; the guided single-page site.

The Worker reads the token from Secrets Store (set during the Deploy to Cloudflare flow, supported since July 2025). If no stored token is found, the site tells you to add the `ai-control-plane-demo-token` secret in the dashboard and reload. The site itself never accepts or handles the token.

## Run locally

```
npm install
cp .dev.vars.example .dev.vars   # put a token in CF_API_TOKEN for local dev
npm run dev
```

Secrets Store bindings do not resolve in local dev, so locally the Worker reads `CF_API_TOKEN` as a plain string from `.dev.vars`. In production it reads from Secrets Store via the binding.

## Clean up

The site has a **Delete everything this demo created** button. It removes the MCP portal, the sample MCP servers, and the AI Gateway, then clears demo state.

## Notes

- The MCP portal needs a CNAME from its hostname to `gateway.agents.cloudflare.com` to actually serve traffic. The demo creates the portal config (visible in the dashboard) and leaves going live as the natural next step.
- MCP Server Portals require a Zero Trust / Access entitlement on the account.
- This is an SE demo asset, not a production template. Treat the created resources as disposable.
