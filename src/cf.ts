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

export async function deleteGateway(token: string, accountId: string) {
  await cf(token, "DELETE", `/accounts/${accountId}/ai-gateway/gateways/${GATEWAY_ID}`);
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

  for (const s of DUMMY_SERVERS) {
    // Idempotent create per server.
    const existing = await cf(
      token,
      "GET",
      `/accounts/${accountId}/access/ai-controls/mcp/servers/${s.id}`,
    );
    if (!existing.ok) {
      const r = await cf(token, "POST", `/accounts/${accountId}/access/ai-controls/mcp/servers`, {
        id: s.id,
        name: s.name,
        hostname: s.hostname,
        auth_type: s.auth_type,
        description: s.description,
      });
      servers.push({ id: s.id, name: s.name, hostname: s.hostname, status: r.ok ? "created" : "skipped" });
    } else {
      servers.push({ id: s.id, name: s.name, hostname: s.hostname, status: "exists" });
    }
  }

  // Create the portal and attach the servers.
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
      allow_code_mode: true,
      secure_web_gateway: false,
      servers: DUMMY_SERVERS.map((s) => s.id),
    });
    if (!r.ok) throw new ApiError("Could not create MCP portal", r);
    portal = r.result;
  }

  return { portal, servers, portalHostname };
}

export async function deleteMcpPortal(token: string, accountId: string) {
  await cf(token, "DELETE", `/accounts/${accountId}/access/ai-controls/mcp/portals/${PORTAL_ID}`);
  for (const s of DUMMY_SERVERS) {
    await cf(token, "DELETE", `/accounts/${accountId}/access/ai-controls/mcp/servers/${s.id}`);
  }
}

// ---- Errors -------------------------------------------------------------

export class ApiError extends Error {
  constructor(message: string, public detail: CfResult) {
    super(message);
  }
  toJSON() {
    return {
      error: this.message,
      status: this.detail.status,
      errors: this.detail.errors,
    };
  }
}
