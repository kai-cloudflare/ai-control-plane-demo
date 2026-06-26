import { page } from "./html";
import {
  resolveAccount,
  createGateway,
  GATEWAY_ID,
  createMcpPortal,
  deleteGateway,
  deleteMcpPortal,
  PORTAL_ID,
  ApiError,
} from "./cf";

interface SecretsStoreSecret {
  get(): Promise<string>;
}

interface Env {
  // Secrets Store binding in production; a plain string from .dev.vars in local dev.
  CF_API_TOKEN?: SecretsStoreSecret | string;
  DEMO_STATE: KVNamespace;
  CF_ACCOUNT_ID?: string;
  MCP_PORTAL_HOSTNAME?: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

// Read the API token from Cloudflare Secrets Store (set during the Deploy to
// Cloudflare flow). Falls back to a plain string binding for local dev only.
// The token is never echoed to the client, logged, or stored in KV.
async function getToken(env: Env): Promise<{ token?: string; source: string }> {
  const b: any = env.CF_API_TOKEN;
  if (!b) return { token: undefined, source: "none" };
  if (typeof b === "string") return b ? { token: b, source: "local" } : { token: undefined, source: "none" };
  if (typeof b.get === "function") {
    try {
      const v = await b.get();
      if (v) return { token: v, source: "secrets-store" };
    } catch {
      /* binding not resolvable */
    }
  }
  return { token: undefined, source: "none" };
}

function portalHostname(env: Env, accountId: string): string {
  return env.MCP_PORTAL_HOSTNAME?.trim() || `mcp-demo-${accountId.slice(0, 8)}.example.com`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && (path === "/" || path === "/index.html")) {
      return new Response(page(), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    try {
      if (path === "/api/status" && request.method === "GET") {
        const { token, source } = await getToken(env);
        let account = null;
        if (token) account = await resolveAccount(token, env.CF_ACCOUNT_ID);
        const state = ((await env.DEMO_STATE.get("state", "json")) as any) || {};
        return json({
          connection: source,
          tokenPresent: !!token,
          account,
          gateway: state.gateway || null,
          portal: state.portal || null,
        });
      }

      if (path === "/api/deploy-gateway" && request.method === "POST") {
        const { token, accountId } = await authed(env);
        const res = await createGateway(token, accountId);
        await mergeState(env, { gateway: { id: GATEWAY_ID, endpoint: res.endpoint, created: res.created } });
        return json({ ok: true, ...res });
      }

      if (path === "/api/deploy-mcp" && request.method === "POST") {
        const { token, accountId } = await authed(env);
        const res = await createMcpPortal(token, accountId, portalHostname(env, accountId));
        await mergeState(env, {
          portal: { id: PORTAL_ID, hostname: res.portalHostname, servers: res.servers },
        });
        return json({ ok: true, ...res });
      }

      if (path === "/api/cleanup" && request.method === "POST") {
        const { token, accountId } = await authed(env);
        await deleteMcpPortal(token, accountId);
        await deleteGateway(token, accountId);
        await env.DEMO_STATE.delete("state");
        return json({ ok: true });
      }

      return new Response("Not found", { status: 404 });
    } catch (e: any) {
      if (e instanceof ApiError) return json(e.toJSON(), 502);
      if (e instanceof AuthError) return json({ error: e.message }, 401);
      return json({ error: String(e?.message || e) }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

class AuthError extends Error {}

async function authed(env: Env): Promise<{ token: string; accountId: string }> {
  const { token } = await getToken(env);
  if (!token) {
    throw new AuthError(
      "No API token in Secrets Store. Add a secret named 'ai-control-plane-demo-token', then reload.",
    );
  }
  const account = await resolveAccount(token, env.CF_ACCOUNT_ID);
  if (!account) throw new AuthError("Token rejected or missing required permissions.");
  return { token, accountId: account.id };
}

async function mergeState(env: Env, patch: Record<string, unknown>) {
  const current = ((await env.DEMO_STATE.get("state", "json")) as any) || {};
  await env.DEMO_STATE.put("state", JSON.stringify({ ...current, ...patch }));
}
