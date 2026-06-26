# AI Control Plane &mdash; Instant Demo

A near one-click Cloudflare demo. Click **Deploy to Cloudflare** (no config to fill in), open the Worker URL, and a guided site walks you through creating a scoped API token and then provisions a real **AI Gateway** and a real **MCP Server Portal** (with sample MCP servers) on your own account. Everything is reversible with one button.

The point: a prospect should finish this in five minutes and feel like they can keep building from here.

## Two ways to run

The app is a small Worker that proxies calls to the Cloudflare API using a token you paste in the site. The token is never stored or logged. Where it travels depends on how you run it:

- **Local mode (most private, recommended for security-sensitive customers).** Run it on your own machine with `wrangler dev`. The token goes browser -> the Worker running on your laptop -> the Cloudflare API. It never leaves your machine except in the direct call to Cloudflare's own API. The site shows a green "Local mode" banner so the customer can see this.

  ```
  npm install
  npm run dev      # opens http://localhost:8787
  ```

- **Hosted mode (lowest friction).** One person deploys the Worker once and shares the URL. The customer just opens the link and pastes their token. The token is used in memory on that Worker and never stored, but it does transit infrastructure the customer does not control, so a CISO may prefer local mode. Deploy with:

  ```
  npx wrangler deploy                       # deploys the Worker named in wrangler.jsonc
  npx wrangler deploy --name my-demo-name   # or a separate, stable instance
  ```

- **Pure static / open an HTML file: not possible.** The Cloudflare API does not send CORS headers, so a browser cannot call it directly. A local or hosted Worker is required to proxy the calls. That Worker is the only thing the token is sent to.

### Deploy to Cloudflare button

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/kai-cloudflare/ai-control-plane-demo)

This forks the repo into the user's GitHub and wires Workers Builds for auto-deploy. It requires completing the GitHub authorization step; if that is skipped, only a placeholder is deployed. For a quick demo, `wrangler deploy` or the hosted URL is simpler.

## The flow

1. Deploy and open the Worker URL.
2. The site links you straight to the API token page and lists the exact permissions. Create the token.
3. Paste it into the site and click **Connect**. The account id is detected from the token automatically, so you never have to find or paste it.
4. Click **Deploy AI Gateway**, then **Create MCP Portal**. Open each result in your dashboard. Tear it all down with the cleanup button.

### The API token

The site's **Create token (permissions pre-filled)** button deep-links to your **account** token page (`?to=/:account/api-tokens`) with the right permissions already checked, using the dashboard's `permissionGroupKeys` query param. You just pick **Account Resources &rarr; your account** and create. Pre-selected permissions:

- **AI Gateway**: Edit (`aig`) &mdash; create the gateway and run the test request
- **Workers AI**: Edit (`ai`) &mdash; the free test inference
- **Access: Apps and Policies**: Edit (`access`) &mdash; MCP portal and servers (the `ai-controls` endpoints)
- **Account Settings**: Read (`account_settings`) &mdash; auto-detect your account id

Set a short TTL and delete it after the demo.

### Test the gateway

After deploying the gateway, click **Send a test request**. It runs a free Workers AI model through your gateway (unified `/ai/v1/chat/completions` endpoint with the `cf-aig-gateway-id` header), shows the model's answer, then reads the gateway logs so you can see the request was captured (status, tokens, duration, cache).

### Where the token lives

The token is kept in your browser tab (`sessionStorage`) and sent to the Worker only to call the Cloudflare API. It is never written to code, never persisted server-side, and never logged. Closing the tab clears it.

> Why not Secrets Store? A Secrets Store binding has to be given its value at deploy time, which would force the deploy screen to ask for a token before you have created one. Collecting it in the guided site keeps the deploy step empty and the experience smooth. For a permanent internal tool you would instead wire a Secrets Store binding and skip the paste step.

## What it builds

- **AI Gateway** (`ai-control-plane-demo`): caching, rate limiting, logging. The site shows the gateway endpoint and a ready-to-run curl.
- **MCP Server Portal** (`ai-control-plane-demo-portal`) with two sample MCP servers (the public, unauthenticated Cloudflare Docs MCP server, plus a replace-me placeholder), so the customer sees governed MCP access behind Cloudflare Access.

## How it works

```
Browser (holds token) ──→ Worker (this app) ──→ Cloudflare REST API
                                                  ├─ GET /accounts                 (detect account)
                                                  ├─ POST /ai-gateway/gateways
                                                  └─ POST /access/ai-controls/mcp/{servers,portals}
```

- `src/index.ts` &mdash; router: serves the site and the `/api/*` actions; token arrives in the request body.
- `src/cf.ts` &mdash; Cloudflare API client and the create/read/delete steps (idempotent).
- `src/html.ts` &mdash; the guided single-page site.

State is not persisted: status is derived live by reading the gateway and portal by their fixed ids, and cleanup deletes them by id. No KV needed.

## Run locally

```
npm install
npm run dev
```

Then open the local URL and paste a token in the site, exactly like production.

## Clean up

The site has a **Delete everything this demo created** button. It removes the MCP portal, the sample MCP servers, and the AI Gateway.

## Notes

- The MCP portal needs a CNAME from its hostname to `gateway.agents.cloudflare.com` to actually serve traffic. The demo creates the portal config (visible in the dashboard) and leaves going live as the natural next step.
- MCP Server Portals require a Zero Trust / Access entitlement on the account.
- This is an SE demo asset, not a production template. Treat the created resources as disposable.
