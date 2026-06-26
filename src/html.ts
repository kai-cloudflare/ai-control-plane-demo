// The guided demo website, served by the Worker at "/".
// The API token is created by the user (guided), pasted here, kept in the
// browser session (sessionStorage), and sent to the Worker only to call the
// Cloudflare API. The account id is auto-detected from the token.

export function page(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AI Control Plane - Instant Demo</title>
<style>
  :root{
    --bg:#0b0e14; --panel:#141925; --panel2:#1b2233; --line:#28304a;
    --txt:#e7ecf5; --muted:#9aa6c0; --orange:#f6821f; --orange2:#fbad41;
    --green:#36c692; --red:#ff6b6b; --radius:14px;
  }
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 600px at 80% -10%,#1d2740 0,var(--bg) 60%);
    color:var(--txt);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
  a{color:var(--orange2);text-decoration:none}
  a:hover{text-decoration:underline}
  .wrap{max-width:920px;margin:0 auto;padding:40px 22px 80px}
  .hero{display:flex;align-items:center;gap:16px;margin-bottom:8px}
  .logo{width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,var(--orange),var(--orange2));
    display:flex;align-items:center;justify-content:center;font-weight:800;color:#1b1300;font-size:20px}
  h1{font-size:27px;margin:0;letter-spacing:-.4px}
  .sub{color:var(--muted);margin:6px 0 26px}
  .pill{display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:999px;
    font-size:13px;border:1px solid var(--line);background:var(--panel)}
  .dot{width:9px;height:9px;border-radius:50%;background:var(--muted)}
  .dot.ok{background:var(--green)} .dot.warn{background:var(--orange2)} .dot.err{background:var(--red)}
  .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:18px 0 30px}
  .mini{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:16px}
  .mini b{display:block;color:var(--orange2);font-size:13px;margin-bottom:4px}
  .mini span{color:var(--muted);font-size:13px}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
    padding:22px;margin:16px 0;position:relative;overflow:hidden}
  .card.locked{opacity:.55}
  .card h2{margin:0 0 4px;font-size:18px}
  .card .step{position:absolute;top:18px;right:20px;color:var(--line);font-weight:800;font-size:34px}
  .card p{color:var(--muted);margin:6px 0 16px}
  button{background:linear-gradient(135deg,var(--orange),var(--orange2));color:#1b1300;border:0;
    font-weight:700;padding:11px 18px;border-radius:10px;cursor:pointer;font-size:14px}
  button.secondary{background:transparent;color:var(--txt);border:1px solid var(--line)}
  button:disabled{opacity:.45;cursor:not-allowed}
  input,textarea{width:100%;background:#0c1018;color:var(--txt);border:1px solid var(--line);
    border-radius:10px;padding:12px;font-family:ui-monospace,Menlo,monospace;font-size:13px}
  textarea{min-height:70px}
  .out{margin-top:14px;background:#0c1018;border:1px solid var(--line);border-radius:10px;padding:14px;display:none}
  .out.show{display:block}
  code,kbd{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
  pre{margin:0;white-space:pre-wrap;word-break:break-all;color:#cdd6ec}
  .row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .kv{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed var(--line)}
  .kv:last-child{border-bottom:0}
  .kv span{color:var(--muted)}
  .tag{font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
  .tag.ok{color:var(--green);border-color:#1f6}
  .note{font-size:12.5px;color:var(--muted)}
  .copy{font-size:12px;padding:6px 10px}
  .perm{background:#0c1018;border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin:10px 0;font-size:13px}
  .perm code{color:var(--orange2)}
  hr{border:0;border-top:1px solid var(--line);margin:26px 0}
  ul.next{margin:8px 0 0;padding-left:18px;color:var(--muted)}
  ul.next li{margin:7px 0}
  label.fld{display:block;font-size:12.5px;color:var(--muted);margin:0 0 6px}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="logo">CF</div>
    <div>
      <h1>AI Control Plane &mdash; Instant Demo</h1>
      <div class="pill"><span id="statusDot" class="dot"></span><span id="statusText">Ready when you are</span></div>
    </div>
  </div>
  <p class="sub">Spin up a working <b>AI Gateway</b> and an <b>MCP Server Portal</b> on your own Cloudflare account. Every button calls the real Cloudflare API. Tear it all down again at the end.</p>

  <div class="grid3">
    <div class="mini"><b>1. Create a token</b><span>We link you straight to the token page with the exact permissions. Paste it back here.</span></div>
    <div class="mini"><b>2. Provision</b><span>This Worker calls the Cloudflare API to build an AI Gateway and an MCP portal with sample servers.</span></div>
    <div class="mini"><b>3. Continue</b><span>Open the results in your dashboard and keep building. Everything is yours to keep or delete.</span></div>
  </div>

  <!-- Step 1: Connect -->
  <div class="card" id="connectCard">
    <span class="step">1</span>
    <h2>Create and connect your API token</h2>
    <p>One step. We never ask for your account id &mdash; it is detected from the token. Your token stays in this browser tab and is sent only to this Worker to call the Cloudflare API.</p>
    <div class="row" style="margin-bottom:6px">
      <a href="https://dash.cloudflare.com/?to=/:account/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22aig%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22ai%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22mcp_portals%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22zone%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22account_settings%22%2C%22type%22%3A%22read%22%7D%5D" target="_blank" rel="noopener"><button>Create token (permissions pre-filled) &rarr;</button></a>
      <span class="note">Opens your account token page with the right permissions already checked.</span>
    </div>
    <div class="perm">Pick <b>Account Resources &rarr; your account</b>, then <b>Continue</b> and <b>Create Token</b>. These should be pre-selected (add any that are missing):<br/>
      <code>AI Gateway: Edit</code> &nbsp; <code>Workers AI: Edit</code> &nbsp; <code>MCP Portals: Edit</code> &nbsp; <code>Zone: Read</code> &nbsp; <code>Account Settings: Read</code></div>
    <label class="fld" for="tokenInput">Paste your token</label>
    <textarea id="tokenInput" placeholder="Paste the API token you just created"></textarea>
    <div class="row" style="margin-top:10px">
      <button id="connectBtn">Connect</button>
      <span class="note" id="connectMsg"></span>
    </div>
  </div>

  <!-- Step 2: AI Gateway -->
  <div class="card locked" id="gwCard">
    <span class="step">2</span>
    <h2>Deploy an AI Gateway</h2>
    <p>Creates a gateway with caching, rate limiting, and full logging. Point any OpenAI / Anthropic / Workers AI app at it by changing one base URL.</p>
    <div class="row">
      <button id="gwBtn" disabled>Deploy AI Gateway</button>
      <button id="gwTestBtn" class="secondary" disabled>Send a test request</button>
      <a id="gwDash" class="note" target="_blank" rel="noopener" style="display:none">Open in dashboard &rarr;</a>
    </div>
    <div class="out" id="gwOut"></div>
    <div class="out" id="gwTestOut"></div>
  </div>

  <!-- Step 3: MCP Portal -->
  <div class="card locked" id="mcpCard">
    <span class="step">3</span>
    <h2>Create an MCP Server Portal</h2>
    <p>Creates an MCP portal behind Cloudflare Access and attaches two sample MCP servers, so you can govern which AI agents reach which tools, with identity and policy in front.</p>
    <label class="fld" for="hostInput">Portal hostname (must be a domain on your Cloudflare account)</label>
    <input id="hostInput" placeholder="leave blank to auto-use a zone on your account, or type mcp.yourdomain.com" />
    <div class="row" style="margin-top:12px">
      <button id="mcpBtn" disabled>Create MCP Portal + sample servers</button>
      <a id="mcpDash" class="note" target="_blank" rel="noopener" style="display:none">Open in dashboard &rarr;</a>
    </div>
    <div class="out" id="mcpOut"></div>
  </div>

  <!-- Step 4: Continue -->
  <div class="card">
    <span class="step">4</span>
    <h2>Continue from here</h2>
    <p>This is a starting point, not a dead end. Natural next steps:</p>
    <ul class="next">
      <li>Add your real LLM provider keys to the AI Gateway and turn on <b>Guardrails</b> (PII redaction, prompt auditing).</li>
      <li>Make the MCP portal live: add a CNAME from your hostname to <code>gateway.agents.cloudflare.com</code>, then attach your own internal MCP servers.</li>
      <li>Add Access policies (MFA, device posture) to the portal, and route MCP traffic through Gateway for DLP.</li>
    </ul>
  </div>

  <hr/>
  <div class="row">
    <button id="cleanupBtn" class="secondary" disabled>Delete everything this demo created</button>
    <span class="note" id="cleanupMsg"></span>
  </div>
  <p class="note" style="margin-top:24px">Built on Cloudflare Workers, AI Gateway, and Access (MCP portals). Your token is never stored server-side. See the README for how it works.</p>
</div>

<script>
  var token = sessionStorage.getItem("cf_token") || "";
  var account = null;

  function el(id){ return document.getElementById(id); }
  function setStatus(cls, text){ el("statusDot").className = "dot " + cls; el("statusText").textContent = text; }
  function show(id, html){ var o = el(id); o.innerHTML = html; o.className = "out show"; }
  function dashLink(a, sub){ a.href = "https://dash.cloudflare.com/?to=/:account" + sub; a.style.display = "inline"; }

  function body(extra){
    var b = { token: token };
    if(extra){ for(var k in extra){ b[k] = extra[k]; } }
    return JSON.stringify(b);
  }
  function post(path, extra){
    return fetch(path, { method:"POST", headers:{ "content-type":"application/json" }, body: body(extra) })
      .then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); });
  }

  function unlock(){
    el("gwCard").className = "card"; el("mcpCard").className = "card";
    el("gwBtn").disabled = false; el("mcpBtn").disabled = false; el("cleanupBtn").disabled = false;
    dashLink(el("gwDash"), "/ai/ai-gateway");
    dashLink(el("mcpDash"), "/zero-trust");
  }

  function onConnected(d){
    account = d.account;
    setStatus("ok", "Connected: " + account.name);
    el("connectMsg").textContent = "";
    unlock();
    if(d.gateway){ renderGateway({ endpoint:d.gateway.endpoint, created:false }); }
    if(d.portal){ renderPortal({ portal:{ name:"AI Control Plane Demo Portal" }, servers:d.portal.servers, portalHostname:d.portal.hostname }); }
  }

  function connect(silent){
    if(!token){ return; }
    if(!silent){ el("connectMsg").textContent = "Connecting..."; }
    post("/api/connect").then(function(res){
      if(res.ok && res.d.ok){ sessionStorage.setItem("cf_token", token); onConnected(res.d); }
      else { el("connectMsg").textContent = (res.d.error || "Failed."); if(!silent){ token=""; sessionStorage.removeItem("cf_token"); } }
    });
  }

  el("connectBtn").onclick = function(){
    var t = el("tokenInput").value.trim();
    if(!t){ el("connectMsg").textContent = "Paste a token first."; return; }
    token = t; connect(false);
  };

  el("gwBtn").onclick = function(){
    el("gwBtn").disabled = true; show("gwOut", "Creating AI Gateway...");
    post("/api/deploy-gateway").then(function(res){
      el("gwBtn").disabled = false;
      if(res.ok && res.d.ok){ renderGateway(res.d); }
      else { show("gwOut", "<span style='color:var(--red)'>" + (res.d.error || "Failed") + "</span>"); }
    });
  };

  function renderGateway(d){
    var ep = d.endpoint;
    var curl = "curl " + ep + "/openai/chat/completions \\\\\\n"
      + "  -H \\"Authorization: Bearer $OPENAI_API_KEY\\" \\\\\\n"
      + "  -H \\"Content-Type: application/json\\" \\\\\\n"
      + "  -d '{\\"model\\":\\"gpt-4o-mini\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"hello\\"}]}'";
    var h = "<div class='kv'><b>AI Gateway</b><span class='tag ok'>" + (d.created ? "created" : "ready") + "</span></div>"
      + "<div class='kv'><span>Endpoint</span></div>"
      + "<pre>" + ep + "</pre>"
      + "<div class='row' style='margin:10px 0'><button class='copy' onclick=\\"cp('" + ep + "',this)\\">Copy endpoint</button></div>"
      + "<div class='kv'><span>Try it (swap in your provider key)</span></div>"
      + "<pre>" + curl + "</pre>";
    show("gwOut", h);
    el("gwDash").style.display = "inline";
    el("gwTestBtn").disabled = false;
  }

  function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  el("gwTestBtn").onclick = function(){
    el("gwTestBtn").disabled = true; show("gwTestOut", "Sending a free Workers AI request through your gateway...");
    post("/api/test-gateway").then(function(res){
      el("gwTestBtn").disabled = false;
      if(res.ok && res.d.ok){ renderTest(res.d); }
      else { show("gwTestOut", "<span style='color:var(--red)'>" + (res.d.error || "Failed") + "</span>"); }
    });
  };

  function renderTest(d){
    var rows = "";
    (d.logs || []).forEach(function(l){
      var meta = (l.status_code||"-") + " · " + ((l.tokens_in||0)+(l.tokens_out||0)) + " tok · " + (l.duration||0) + "ms" + (l.cached ? " · cached" : "");
      rows += "<div class='kv'><span>" + esc(l.model||"model") + "</span><code>" + meta + "</code></div>";
    });
    if(!rows){ rows = "<div class='kv'><span class='note'>Logs not visible yet, click Send a test request again to refresh.</span></div>"; }
    var h = "<div class='kv'><b>Model</b><code>" + esc(d.model) + "</code></div>"
      + "<div class='kv'><span>Response</span></div><pre>" + esc(d.answer) + "</pre>"
      + "<div class='kv'><b>Recent gateway logs</b></div>" + rows;
    show("gwTestOut", h);
  }

  el("mcpBtn").onclick = function(){
    el("mcpBtn").disabled = true; show("mcpOut", "Creating MCP portal and sample servers...");
    var host = el("hostInput").value.trim();
    post("/api/deploy-mcp", host ? { portalHostname: host } : null).then(function(res){
      el("mcpBtn").disabled = false;
      if(res.ok && res.d.ok){ renderPortal(res.d); }
      else { show("mcpOut", "<span style='color:var(--red)'>" + (res.d.error || "Failed") + "</span>"); }
    });
  };

  function renderPortal(d){
    var rows = "";
    (d.servers || []).forEach(function(s){
      rows += "<div class='kv'><span>" + s.name + "</span><code>" + s.hostname + "</code></div>";
    });
    var h = "<div class='kv'><b>" + (d.portal && d.portal.name ? d.portal.name : "MCP Portal") + "</b><span class='tag ok'>ready</span></div>"
      + "<div class='kv'><span>Portal hostname (add a CNAME to go live)</span><code>" + d.portalHostname + "</code></div>"
      + "<div class='kv'><b>Attached MCP servers</b></div>" + rows
      + "<p class='note' style='margin-top:10px'>Open Zero Trust &rarr; Access controls &rarr; AI controls to see the portal, its servers, and add Access policies.</p>";
    show("mcpOut", h);
    el("mcpDash").style.display = "inline";
  }

  el("cleanupBtn").onclick = function(){
    el("cleanupBtn").disabled = true; el("cleanupMsg").textContent = "Deleting...";
    post("/api/cleanup").then(function(res){
      el("cleanupBtn").disabled = false;
      if(res.ok && res.d.ok){
        el("cleanupMsg").textContent = "Done. Gateway and MCP portal removed.";
        el("gwOut").className = "out"; el("mcpOut").className = "out";
      } else { el("cleanupMsg").textContent = (res.d.error || "Failed"); }
    });
  };

  function cp(text, btn){
    navigator.clipboard.writeText(text).then(function(){ var o = btn.textContent; btn.textContent = "Copied"; setTimeout(function(){ btn.textContent = o; }, 1200); });
  }
  window.cp = cp;

  // If a token is already in this session, reconnect silently.
  if(token){ el("tokenInput").value = token; setStatus("warn", "Reconnecting..."); connect(true); }
</script>
</body>
</html>`;
}
