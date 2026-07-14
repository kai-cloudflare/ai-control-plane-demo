// AI Gateway demo portal - Worker backend.
//
// Routes:
//   GET /api/gateway        -> gateway metadata
//   GET /api/overview       -> KPIs, time series, by-model/provider, business impact
//   GET /api/guardrails     -> guardrail config, summary, categories, recent blocks
//   GET /api/costs          -> cost by model/provider, spend limits, savings
//   GET /api/logs           -> recent request logs (supports ?status=&limit=)
// Everything else is served from static assets (the dashboard SPA).
//
// All endpoints accept ?range=24h|7d|30d (default 30d).

import {
  getGateway,
  getGateways,
  getOverview,
  getAnalyticsSeries,
  getGuardrails,
  getCosts,
  getLogs,
  getGovernance,
} from "./data.js";
import { provisionTemporaryAccount } from "./pow.js";
import {
  resolveAccount,
  createGateway,
  getGatewayStatus,
  getPortalStatus,
  createMcpPortal,
  getFirstZone,
  inspectMcpServer,
  DUMMY_SERVERS,
  deleteMcpPortal,
  deleteGateway,
  runGatewayTest,
  getGatewayLogs,
  checkAiGatewayReady,
} from "./cf.js";

const RANGES = new Set(["24h", "7d", "30d"]);

// Temporary-account provisioning is only allowed when running on a local
// laptop (wrangler dev), never from a deployed Worker on Cloudflare's network
// (Cloudflare blocks preview provisioning that originates from its own IPs).
function isLocal(env) {
  return (env && env.DEPLOY_ENV) === "local";
}

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
    ...init,
  });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function authed(request) {
  const body = await readBody(request);
  if (!body.token) throw new Error("No API token provided. Connect first.");
  const account = await resolveAccount(body.token);
  if (!account) throw new Error("Token rejected or missing required permissions.");
  return { token: body.token, accountId: account.id, body };
}

function parseRange(url) {
  const r = url.searchParams.get("range") || "30d";
  return RANGES.has(r) ? r : "30d";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (pathname === "/deploy.html") {
      return Response.redirect(new URL("/#step-3", request.url), 302);
    }

    if (pathname.startsWith("/api/")) {
      const range = parseRange(url);
      try {
        switch (pathname) {
          case "/api/gateway":
            return json(getGateway());
          case "/api/gateways":
            return json(getGateways(range));
          case "/api/overview":
            return json(getOverview(range));
          case "/api/analytics-series":
            return json(getAnalyticsSeries(range));
          case "/api/guardrails":
            return json(getGuardrails(range));
          case "/api/costs":
            return json(getCosts(range));
          case "/api/governance":
            return json(getGovernance(range));
          case "/api/logs": {
            const limit = Math.min(Number(url.searchParams.get("limit")) || 60, 200);
            const status = url.searchParams.get("status") || "all";
            return json(getLogs({ range, limit, status }));
          }
          // --- AI Control Plane provisioning endpoints ---
          case "/api/connect": {
            if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
            const { token } = await readBody(request);
            if (!token) return json({ error: "Paste a token first." }, { status: 400 });
            const account = await resolveAccount(token);
            if (!account) return json({ error: "Token rejected. Check the permissions and try again." }, { status: 401 });
            const [gateway, portal] = await Promise.all([
              getGatewayStatus(token, account.id),
              getPortalStatus(token, account.id),
            ]);
            return json({ ok: true, account, gateway, portal });
          }
          case "/api/deploy-gateway": {
            if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
            const { token, accountId } = await authed(request);
            const res = await createGateway(token, accountId);
            return json({ ok: true, ...res });
          }
          case "/api/test-gateway": {
            if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
            const { token, accountId } = await authed(request);
            const test = await runGatewayTest(token, accountId);
            await new Promise((r) => setTimeout(r, 1500));
            const logs = await getGatewayLogs(token, accountId);
            return json({ ok: true, ...test, logs });
          }
          case "/api/real-logs": {
            if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
            const { token, accountId } = await authed(request);
            const logs = await getGatewayLogs(token, accountId);
            return json({ ok: true, logs });
          }
          case "/api/deploy-mcp": {
            if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
            const { token, accountId, body } = await authed(request);
            let host = (body?.portalHostname || "").trim();
            if (!host) {
              const zone = await getFirstZone(token, accountId);
              if (zone) host = `mcp-demo.${zone}`;
            }
            if (!host) {
              return json({
                error: "MCP portals need a hostname on a domain in your Cloudflare account. No zone was found, so enter a hostname in the field and try again."
              }, { status: 400 });
            }
            const res = await createMcpPortal(token, accountId, host);
            return json({ ok: true, ...res });
          }
          case "/api/inspect-mcp": {
            if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
            const { token, accountId } = await authed(request);
            const res = await inspectMcpServer(token, accountId, DUMMY_SERVERS[0].id);
            return json({ ok: true, ...res });
          }
          case "/api/cleanup": {
            if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
            const { token, accountId } = await authed(request);
            await deleteMcpPortal(token, accountId);
            await deleteGateway(token, accountId);
            return json({ ok: true });
          }
          // --- Runtime config for the client (feature flags) ---
          case "/api/config": {
            return json({ ok: true, tempAccountsEnabled: isLocal(env) });
          }
          // --- One-click temporary account provisioning (local laptop only) ---
          case "/api/provision-temp-account": {
            if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
            if (!isLocal(env)) {
              return json({
                error: "Temporary account creation is only available when running this portal locally (wrangler dev). Cloudflare blocks preview provisioning from its own network, so use the existing-account option here.",
              }, { status: 403 });
            }
            const accountInfo = await provisionTemporaryAccount();
            return json({ ok: true, ...accountInfo });
          }
          // --- Poll readiness of a provisioned temporary account ---
          case "/api/temp-status": {
            if (request.method !== "POST") return json({ error: "method_not_allowed" }, { status: 405 });
            if (!isLocal(env)) return json({ error: "not_available" }, { status: 403 });
            const { token, accountId } = await readBody(request);
            if (!token || !accountId) return json({ error: "Missing token or accountId." }, { status: 400 });
            const status = await checkAiGatewayReady(token, accountId);
            return json({ ok: true, ...status });
          }
          default:
            return json({ error: "not_found", path: pathname }, { status: 404 });
        }
      } catch (err) {
        return json({ error: String(err.message || err) }, { status: 500 });
      }
    }

    // Root serves our minimalist portal landing page.
    if (pathname === "/") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url), request));
    }

    // Fall through to static assets (converted dashboard pages + overlay).
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not found", { status: 404 });
  },
};
