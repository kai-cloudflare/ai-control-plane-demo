// Minimal Cloudflare REST API client + the demo "steps".
// Integrated from the AI Control Plane TypeScript project.

const API = "https://api.cloudflare.com/client/v4";

async function cf(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
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
export async function resolveAccount(token, preferredId) {
  const r = await cf(token, "GET", "/accounts");
  if (!r.ok || !r.result?.length) return null;
  if (preferredId) {
    const match = r.result.find((a) => a.id === preferredId);
    if (match) return { id: match.id, name: match.name };
  }
  return { id: r.result[0].id, name: r.result[0].name };
}

// ---- Step 1: AI Gateway -------------------------------------------------
export const GATEWAY_ID = "ai-control-plane-demo";

export async function createGateway(token, accountId) {
  const existing = await cf(
    token,
    "GET",
    `/accounts/${accountId}/ai-gateway/gateways/${GATEWAY_ID}`
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

export function gatewayEndpoint(accountId) {
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${GATEWAY_ID}`;
}

export async function getGatewayStatus(token, accountId) {
  const r = await cf(token, "GET", `/accounts/${accountId}/ai-gateway/gateways/${GATEWAY_ID}`);
  return r.ok && r.result ? { id: GATEWAY_ID, endpoint: gatewayEndpoint(accountId) } : null;
}

export async function deleteGateway(token, accountId) {
  await cf(token, "DELETE", `/accounts/${accountId}/ai-gateway/gateways/${GATEWAY_ID}`);
}

export async function getFirstZone(token, accountId) {
  const r = await cf(token, "GET", `/zones?account.id=${accountId}&per_page=5`);
  return r.ok && r.result?.length ? r.result[0].name : null;
}

// Readiness probe for freshly provisioned temporary preview accounts.
// A temp account cannot reach AI Gateway (auth error 10000) until it has been
// promoted/claimed, so we treat a non-auth response as "ready".
export async function checkAiGatewayReady(token, accountId) {
  const r = await cf(token, "GET", `/accounts/${accountId}/ai-gateway/gateways`);
  const authErr =
    r.status === 401 ||
    r.status === 403 ||
    (Array.isArray(r.errors) && r.errors.some((e) => e.code === 10000));
  return { ready: r.ok && !authErr, status: r.status };
}

// ---- Step 2: MCP Server Portal + dummy MCP servers ----------------------
export const DUMMY_SERVERS = [
  {
    id: "demo-cloudflare-docs",
    name: "Cloudflare Docs (demo)",
    hostname: "https://docs.mcp.cloudflare.com/mcp",
    auth_type: "unauthenticated",
    description: "Public Cloudflare Documentation MCP server. Safe to use for testing.",
  },
  {
    id: "demo-sample-internal",
    name: "Sample Internal MCP (replace me)",
    hostname: "https://example.com/mcp",
    auth_type: "unauthenticated",
    description: "Placeholder. Point this at one of your own internal MCP servers.",
  },
];

export const PORTAL_ID = "ai-control-plane-demo-portal";

export async function createMcpPortal(token, accountId, portalHostname) {
  const servers = [];
  const attachedIds = [];

  for (const s of DUMMY_SERVERS) {
    const existing = await cf(
      token,
      "GET",
      `/accounts/${accountId}/access/ai-controls/mcp/servers/${s.id}`
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
    if (r.ok) attachedIds.push(s.id);
  }

  let portal;
  const existingPortal = await cf(
    token,
    "GET",
    `/accounts/${accountId}/access/ai-controls/mcp/portals/${PORTAL_ID}`
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
      servers: attachedIds.map((id) => ({ server_id: id })),
    });
    if (!r.ok) throw new ApiError("Could not create MCP portal", r);
    portal = r.result;
  }

  return { portal, servers, portalHostname };
}

export async function getPortalStatus(token, accountId) {
  const r = await cf(token, "GET", `/accounts/${accountId}/access/ai-controls/mcp/portals/${PORTAL_ID}`);
  if (!r.ok || !r.result) return null;
  return {
    id: PORTAL_ID,
    hostname: r.result.hostname,
    servers: DUMMY_SERVERS.map((s) => ({ id: s.id, name: s.name, hostname: s.hostname, status: "exists" })),
  };
}

export async function inspectMcpServer(token, accountId, serverId) {
  await cf(token, "POST", `/accounts/${accountId}/access/ai-controls/mcp/servers/${serverId}/sync`);
  await new Promise((r) => setTimeout(r, 2500));
  const g = await cf(token, "GET", `/accounts/${accountId}/access/ai-controls/mcp/servers/${serverId}`);
  if (!g.ok || !g.result) throw new ApiError("Could not query the MCP server", g);
  return {
    name: g.result.name,
    hostname: g.result.hostname,
    status: g.result.status,
    tools: (g.result.tools || []).map((t) => ({ name: t.name, description: t.description || "" })),
    prompts: (g.result.prompts || []).map((p) => p.name),
  };
}

export async function deleteMcpPortal(token, accountId) {
  await cf(token, "DELETE", `/accounts/${accountId}/access/ai-controls/mcp/portals/${PORTAL_ID}`);
  for (const s of DUMMY_SERVERS) {
    await cf(token, "DELETE", `/accounts/${accountId}/access/ai-controls/mcp/servers/${s.id}`);
  }
}

// ---- Step 1b: send a free test request through the gateway --------------
export const TEST_MODEL = "@cf/meta/llama-3.2-3b-instruct";

export async function runGatewayTest(token, accountId) {
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
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError("Test request failed", { ok: false, status: res.status, errors: data?.errors });
  }
  const answer = data?.choices?.[0]?.message?.content || data?.result?.response || "(no text returned)";
  return { answer, model: TEST_MODEL };
}

export async function getGatewayLogs(token, accountId) {
  const r = await cf(token, "GET", `/accounts/${accountId}/ai-gateway/gateways/${GATEWAY_ID}/logs`);
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
  constructor(message, detail) {
    super(message);
    this.detail = detail;
  }
  toJSON() {
    const apiMsg = this.detail.errors?.map((e) => e.message).filter(Boolean).join("; ");
    return {
      error: apiMsg ? `${this.message}: ${apiMsg}` : this.message,
      status: this.detail.status,
      errors: this.detail.errors,
    };
  }
}
