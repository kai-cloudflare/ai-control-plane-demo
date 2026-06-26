import { page } from "./html";
import {
  resolveAccount,
  createGateway,
  getGatewayStatus,
  GATEWAY_ID,
  createMcpPortal,
  getPortalStatus,
  deleteGateway,
  deleteMcpPortal,
  PORTAL_ID,
  ApiError,
} from "./cf";

// Zero-config Worker: no bindings. The API token is collected by the website
// (guided), held in the browser for the session, and sent with each API call.
// It is used only to call the Cloudflare API and is never stored or logged.
interface Env {}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

class AuthError extends Error {}

async function readBody(request: Request): Promise<{ token?: string; portalHostname?: string }> {
  try {
    return (await request.json()) as { token?: string; portalHostname?: string };
  } catch {
    return {};
  }
}

// Resolve token + account for an action. Account is auto-detected from the
// token, so the user never has to find or paste their account id.
async function authed(request: Request): Promise<{ token: string; accountId: string; body: any }> {
  const body = await readBody(request);
  if (!body.token) throw new AuthError("No API token provided. Connect first.");
  const account = await resolveAccount(body.token);
  if (!account) throw new AuthError("Token rejected or missing required permissions.");
  return { token: body.token, accountId: account.id, body };
}

function portalHostname(body: any, accountId: string): string {
  const h = (body?.portalHostname || "").trim();
  return h || `mcp-demo-${accountId.slice(0, 8)}.example.com`;
}

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "GET" && (path === "/" || path === "/index.html")) {
      return new Response(page(), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    try {
      // Validate the pasted token, return the detected account + what already exists.
      if (path === "/api/connect" && request.method === "POST") {
        const { token } = await readBody(request);
        if (!token) return json({ error: "Paste a token first." }, 400);
        const account = await resolveAccount(token);
        if (!account) {
          return json({ error: "Token rejected. Check the permissions and try again." }, 401);
        }
        const [gateway, portal] = await Promise.all([
          getGatewayStatus(token, account.id),
          getPortalStatus(token, account.id),
        ]);
        return json({ ok: true, account, gateway, portal });
      }

      if (path === "/api/deploy-gateway" && request.method === "POST") {
        const { token, accountId } = await authed(request);
        const res = await createGateway(token, accountId);
        return json({ ok: true, ...res });
      }

      if (path === "/api/deploy-mcp" && request.method === "POST") {
        const { token, accountId, body } = await authed(request);
        const res = await createMcpPortal(token, accountId, portalHostname(body, accountId));
        return json({ ok: true, ...res });
      }

      if (path === "/api/cleanup" && request.method === "POST") {
        const { token, accountId } = await authed(request);
        await deleteMcpPortal(token, accountId);
        await deleteGateway(token, accountId);
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
