// Minimal Cloudflare REST API client + the demo "steps".
// Everything here runs inside the Worker. The API token is supplied by the
// caller (read from Secrets Store, or a transient runtime paste) and is never logged.

const API = "https://api.cloudflare.com/client/v4";

export interface CfResult<T = any> {
  ok: boolean;
  status: number;
  result?: T;
  errors?: { code: number; message: string }[];
}

export async function cf<T = any>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<CfResult<T>> {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  return {
    ok: res.ok && data?.success !== false,
    status: res.status,
    result: data?.result,
    errors: data?.errors,
  };
}

// ---- Account resolution -------------------------------------------------

export async function resolveAccount(
  token: string,
  preferredId?: string,
): Promise<{ id: string; name: string } | null> {
  const r = await cf<{ id: string; name: string }[]>(token, "GET", "/accounts");
  if (!r.ok || !r.result?.length) return null;
  if (preferredId) {
    const match = r.result.find((a) => a.id === preferredId);
    if (match) return { id: match.id, name: match.name };
  }
  return { id: r.result[0].id, name: r.result[0].name };
}

// ---- Step 1: AI Gateway -------------------------------------------------

export const GATEWAY_ID = "ai-control-plane-demo";

export async function createGateway(token: string, accountId: string) {
  // Idempotent: if it already exists, fetch and return it.
  const existing = await cf(
    token,
    "GET",
    `/accounts/${accountId}/ai-gateway/gateways/${GATEWAY_ID}`,
  );
  if (existing.ok && existing.result) {
    return { created: false, gateway: existing.result, endpoint: gatewayEndpoint(accountId) };
  }
  const r = await cf(token, "POST", `/accounts/${accountId}/ai-gateway/gateways`, {
    id: GATEWAY_ID,
    cache_ttl: 3600,
    cache_invalidate_on_update: true,
    collect_logs: true,
    rate_limiting_interval: 60,
    rate_limiting_limit: 100,
    rate_limiting_technique: "sliding",
  });
  if (!r.ok) throw new ApiError("Could not create AI Gateway", r);
  return { created: true, gateway: r.result, endpoint: gatewayEndpoint(accountId) };
}

export function gatewayEndpoint(accountId: string) {
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${GATEWAY_ID}`;
}

export async function getGatewayStatus(token: string, accountId: string) {
  const r = await cf(token, "GET", `/accounts/${accountId}/ai-gateway/gateways/${GATEWAY_ID}`);
  return r.ok && r.result ? { id: GATEWAY_ID, endpoint: gatewayEndpoint(accountId) } : null;
}

export async function deleteGateway(token: string, accountId: string) {
  await cf(token, "DELETE", `/accounts/${accountId}/ai-gateway/gateways/${GATEWAY_ID}`);
}

// MCP portals require a real hostname on the account (a domain in one of its
// zones). Auto-detect the first zone so customers do not have to type it.
export async function getFirstZone(token: string, accountId: string): Promise<string | null> {
  const r = await cf<any[]>(token, "GET", `/zones?account.id=${accountId}&per_page=5`);
  return r.ok && r.result?.length ? r.result[0].name : null;
}

// ---- Step 2: MCP Server Portal + dummy MCP servers ----------------------

// Public, unauthenticated MCP server used as a safe "dummy" to populate the portal.
export const DUMMY_SERVERS = [
  {
    id: "demo-cloudflare-docs",
    name: "Cloudflare Docs (demo)",
    hostname: "https://docs.mcp.cloudflare.com/mcp",
    auth_type: "unauthenticated" as const,
    description: "Public Cloudflare Documentation MCP server. Safe to use for testing.",
  },
  {
    id: "demo-sample-internal",
    name: "Sample Internal MCP (replace me)",
    hostname: "https://example.com/mcp",
    auth_type: "unauthenticated" as const,
    description: "Placeholder. Point this at one of your own internal MCP servers.",
  },
];

export const PORTAL_ID = "ai-control-plane-demo-portal";

export async function createMcpPortal(
  token: string,
  accountId: string,
  portalHostname: string,
) {
  const servers: { id: string; name: string; hostname: string; status: string }[] = [];
  const attachedIds: string[] = [];

  for (const s of DUMMY_SERVERS) {
    // Idempotent create per server.
    const existing = await cf(
      token,
      "GET",
      `/accounts/${accountId}/access/ai-controls/mcp/servers/${s.id}`,
    );
    if (existing.ok && existing.result) {
      servers.push({ id: s.id, name: s.name, hostname: s.hostname, status: "exists" });
      attachedIds.push(s.id);
      continue;
    }
    const r = await cf(token, "POST", `/accounts/${accountId}/access/ai-controls/mcp/servers`, {
      id: s.id,
      name: s.name,
      hostname: s.hostname,
      auth_type: s.auth_type,
      description: s.description,
    });
    servers.push({ id: s.id, name: s.name, hostname: s.hostname, status: r.ok ? "created" : "skipped" });
    if (r.ok) attachedIds.push(s.id); // only attach servers that exist, or the portal create fails
  }

  // Create the portal and attach the servers that exist.
  let portal: any;
  const existingPortal = await cf(
    token,
    "GET",
    `/accounts/${accountId}/access/ai-controls/mcp/portals/${PORTAL_ID}`,
  );
  if (existingPortal.ok && existingPortal.result) {
    portal = existingPortal.result;
  } else {
    const r = await cf(token, "POST", `/accounts/${accountId}/access/ai-controls/mcp/portals`, {
      id: PORTAL_ID,
      name: "AI Control Plane Demo Portal",
      hostname: portalHostname,
      description: "Created by the AI Control Plane demo. Governs MCP server access behind Cloudflare Access.",
      allow_code_mode: false,
      secure_web_gateway: false,
      // The API expects objects: { server_id }, not bare ids.
      servers: attachedIds.map((id) => ({ server_id: id })),
    });
    if (!r.ok) throw new ApiError("Could not create MCP portal", r);
    portal = r.result;
  }

  return { portal, servers, portalHostname };
}

export async function getPortalStatus(token: string, accountId: string) {
  const r = await cf(token, "GET", `/accounts/${accountId}/access/ai-controls/mcp/portals/${PORTAL_ID}`);
  if (!r.ok || !r.result) return null;
  return {
    id: PORTAL_ID,
    hostname: r.result.hostname,
    servers: DUMMY_SERVERS.map((s) => ({ id: s.id, name: s.name, hostname: s.hostname, status: "exists" })),
  };
}

// Exercise the portal's MCP server: trigger a capability sync, then read back
// the tools and prompts Cloudflare discovered. A real request that proves the
// portal can see and broker the server, without needing DNS or Access set up.
export async function inspectMcpServer(token: string, accountId: string, serverId: string) {
  await cf(token, "POST", `/accounts/${accountId}/access/ai-controls/mcp/servers/${serverId}/sync`);
  await new Promise((r) => setTimeout(r, 2500));
  const g = await cf<any>(token, "GET", `/accounts/${accountId}/access/ai-controls/mcp/servers/${serverId}`);
  if (!g.ok || !g.result) throw new ApiError("Could not query the MCP server", g);
  const r = g.result;
  return {
    name: r.name,
    hostname: r.hostname,
    status: r.status,
    tools: (r.tools || []).map((t: any) => ({ name: t.name, description: t.description || "" })),
    prompts: (r.prompts || []).map((p: any) => p.name),
  };
}

export async function deleteMcpPortal(token: string, accountId: string) {
  await cf(token, "DELETE", `/accounts/${accountId}/access/ai-controls/mcp/portals/${PORTAL_ID}`);
  for (const s of DUMMY_SERVERS) {
    await cf(token, "DELETE", `/accounts/${accountId}/access/ai-controls/mcp/servers/${s.id}`);
  }
}

// ---- Step 1b: send a free test request through the gateway --------------

// Uses the unified AI endpoint with a free Workers AI model, routed through our
// gateway via the cf-aig-gateway-id header. Needs only the AI Gateway permission.
export const TEST_MODEL = "@cf/meta/llama-3.2-3b-instruct";

export async function runGatewayTest(token: string, accountId: string) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "cf-aig-gateway-id": GATEWAY_ID,
      },
      body: JSON.stringify({
        model: TEST_MODEL,
        messages: [{ role: "user", content: "In one short sentence, what does an AI gateway do?" }],
      }),
    },
  );
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError("Test request failed", { ok: false, status: res.status, errors: data?.errors });
  }
  const answer =
    data?.choices?.[0]?.message?.content || data?.result?.response || "(no text returned)";
  return { answer, model: TEST_MODEL };
}

export async function getGatewayLogs(token: string, accountId: string) {
  const r = await cf<any[]>(token, "GET", `/accounts/${accountId}/ai-gateway/gateways/${GATEWAY_ID}/logs`);
  const rows = Array.isArray(r.result) ? r.result : [];
  rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return rows.slice(0, 5).map((l) => ({
    model: l.model,
    provider: l.provider,
    status_code: l.status_code,
    success: l.success,
    cached: l.cached,
    duration: l.duration,
    tokens_in: l.tokens_in,
    tokens_out: l.tokens_out,
    created_at: l.created_at,
  }));
}

// ---- Errors -------------------------------------------------------------

export class ApiError extends Error {
  constructor(message: string, public detail: CfResult) {
    super(message);
  }
  toJSON() {
    const apiMsg = this.detail.errors?.map((e) => e.message).filter(Boolean).join("; ");
    return {
      // Surface the real Cloudflare API error text so it shows in the UI.
      error: apiMsg ? `${this.message}: ${apiMsg}` : this.message,
      status: this.detail.status,
      errors: this.detail.errors,
    };
  }
}
