// The guided demo website, served by the Worker at "/".
// Plain HTML/CSS/JS, no build step. The API token is read by the Worker from
// Cloudflare Secrets Store (set during deploy), so the site never handles it.

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
  .card h2{margin:0 0 4px;font-size:18px}
  .card .step{position:absolute;top:18px;right:20px;color:var(--line);font-weight:800;font-size:34px}
  .card p{color:var(--muted);margin:6px 0 16px}
  button{background:linear-gradient(135deg,var(--orange),var(--orange2));color:#1b1300;border:0;
    font-weight:700;padding:11px 18px;border-radius:10px;cursor:pointer;font-size:14px}
  button.secondary{background:transparent;color:var(--txt);border:1px solid var(--line)}
  button:disabled{opacity:.45;cursor:not-allowed}
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
  hr{border:0;border-top:1px solid var(--line);margin:26px 0}
  .secure{border-left:3px solid var(--green);background:var(--panel2);padding:12px 14px;border-radius:8px;font-size:13.5px;color:#cfe9dd;display:none}
  .warnbox{border-left:3px solid var(--orange2);background:var(--panel2);padding:14px 16px;border-radius:8px;font-size:13.5px;color:#f3e2c6;display:none}
  ul.next{margin:8px 0 0;padding-left:18px;color:var(--muted)}
  ul.next li{margin:7px 0}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="logo">CF</div>
    <div>
      <h1>AI Control Plane &mdash; Instant Demo</h1>
      <div class="pill"><span id="statusDot" class="dot"></span><span id="statusText">Checking connection&hellip;</span></div>
    </div>
  </div>
  <p class="sub">Spin up a working <b>AI Gateway</b> and an <b>MCP Server Portal</b> on your own Cloudflare account in two clicks. Nothing here is a mockup &mdash; every button calls the real Cloudflare API. Tear it all down again at the end.</p>

  <div class="grid3">
    <div class="mini"><b>1. Secure token</b><span>Your API token was stored in Cloudflare Secrets Store during deploy. This app reads it through a binding and never sees or logs it.</span></div>
    <div class="mini"><b>2. Provision</b><span>This Worker calls the Cloudflare API to create an AI Gateway and an MCP portal with sample servers.</span></div>
    <div class="mini"><b>3. Continue</b><span>Open the results in your dashboard and keep building. Everything is yours to keep or delete.</span></div>
  </div>

  <div class="secure" id="secureBanner">
    Your API token is stored in <b>Cloudflare Secrets Store</b> and read by this Worker through a binding. It is never exposed in code, logs, or this page.
  </div>

  <div class="warnbox" id="warnBanner">
    <b>No token found in Secrets Store.</b> Add a secret named <code>ai-control-plane-demo-token</code> to your account's Secrets Store (or redeploy and paste the token when prompted), then reload this page.
    <div style="margin-top:8px"><a id="ssDash" target="_blank" rel="noopener">Open Secrets Store in the dashboard &rarr;</a></div>
  </div>

  <!-- Step 1: AI Gateway -->
  <div class="card">
    <span class="step">1</span>
    <h2>Deploy an AI Gateway</h2>
    <p>Creates a gateway with caching, rate limiting, and full logging. Point any OpenAI / Anthropic / Workers AI app at it by changing one base URL.</p>
    <div class="row">
      <button id="gwBtn" disabled>Deploy AI Gateway</button>
      <a id="gwDash" class="note" target="_blank" rel="noopener" style="display:none">Open in dashboard &rarr;</a>
    </div>
    <div class="out" id="gwOut"></div>
  </div>

  <!-- Step 2: MCP Portal -->
  <div class="card">
    <span class="step">2</span>
    <h2>Create an MCP Server Portal</h2>
    <p>Creates an MCP portal behind Cloudflare Access and attaches two sample MCP servers, so you can govern which AI agents reach which tools, with identity and policy in front.</p>
    <div class="row">
      <button id="mcpBtn" disabled>Create MCP Portal + sample servers</button>
      <a id="mcpDash" class="note" target="_blank" rel="noopener" style="display:none">Open in dashboard &rarr;</a>
    </div>
    <div class="out" id="mcpOut"></div>
  </div>

  <!-- Step 3: Continue -->
  <div class="card">
    <span class="step">3</span>
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
  <p class="note" style="margin-top:24px">Built on Cloudflare Workers, Secrets Store, AI Gateway, and Access (MCP portals). See the README for how it works.</p>
</div>

<script>
  var account = null;

  function el(id){ return document.getElementById(id); }
  function setStatus(cls, text){ el("statusDot").className = "dot " + cls; el("statusText").textContent = text; }
  function show(id, html){ var o = el(id); o.innerHTML = html; o.className = "out show"; }

  function post(path){
    return fetch(path, { method:"POST", headers:{ "content-type":"application/json" }, body:"{}" })
      .then(function(r){ return r.json().then(function(d){ return { ok:r.ok, d:d }; }); });
  }

  function enableActions(on){
    el("gwBtn").disabled = !on; el("mcpBtn").disabled = !on; el("cleanupBtn").disabled = !on;
  }

  function dashLink(a, sub){ a.href = "https://dash.cloudflare.com/?to=/:account" + sub; a.style.display = "inline"; }

  function init(){
    el("ssDash").href = "https://dash.cloudflare.com/?to=/:account/secrets-store";
    fetch("/api/status").then(function(r){ return r.json(); }).then(function(s){
      account = s.account;
      if(s.tokenPresent && account){
        el("secureBanner").style.display = "block";
        setStatus("ok", "Connected: " + account.name);
        enableActions(true);
        dashLink(el("gwDash"), "/ai/ai-gateway");
        dashLink(el("mcpDash"), "/zero-trust");
      } else if(s.tokenPresent && !account){
        setStatus("err", "Token present but rejected (check permissions)");
        el("warnBanner").style.display = "block";
        enableActions(false);
      } else {
        setStatus("warn", "No token in Secrets Store");
        el("warnBanner").style.display = "block";
        enableActions(false);
      }
      if(s.gateway){ renderGateway({ endpoint:s.gateway.endpoint, created:false }); }
      if(s.portal){ renderPortal({ portal:{ name:"AI Control Plane Demo Portal" }, servers:s.portal.servers, portalHostname:s.portal.hostname }); }
    }).catch(function(){ setStatus("err", "Could not reach the Worker"); });
  }

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
      + "<pre id='ep'>" + ep + "</pre>"
      + "<div class='row' style='margin:10px 0'><button class='copy' onclick=\\"cp('" + ep + "',this)\\">Copy endpoint</button></div>"
      + "<div class='kv'><span>Try it (swap in your provider key)</span></div>"
      + "<pre>" + curl + "</pre>";
    show("gwOut", h);
    el("gwDash").style.display = "inline";
  }

  el("mcpBtn").onclick = function(){
    el("mcpBtn").disabled = true; show("mcpOut", "Creating MCP portal and sample servers...");
    post("/api/deploy-mcp").then(function(res){
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

  init();
</script>
</body>
</html>`;
}
