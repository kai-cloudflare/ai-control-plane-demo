// Proof-of-Work solver and Account Provisioning for Cloudflare's temporary preview accounts.
// Replicates Wrangler's internal cli.js algorithm using Web Crypto (compatible with Workers).

const API = "https://api.cloudflare.com/client/v4";

// base64url decoder
function base64urlToBytes(b64url) {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// base64 encoder
function bytesToBase64(bytes) {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

// Solve the SHA-256 proof-of-work challenge
export async function solveChallenge(challenge) {
  const seedBytes = base64urlToBytes(challenge.seed);
  const k = challenge.k;
  const g = challenge.g;

  const checkpoints = [];
  
  // First hash of the seed is checkpoints[0]
  let h = await crypto.subtle.digest("SHA-256", seedBytes);
  checkpoints.push(new Uint8Array(h));

  for (let j = 0; j < k; j++) {
    for (let i = 0; i < g; i++) {
      h = await crypto.subtle.digest("SHA-256", h);
    }
    checkpoints.push(new Uint8Array(h));
  }

  // Concatenate all checkpoints
  const totalLength = checkpoints.reduce((acc, c) => acc + c.length, 0);
  const resultBytes = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of checkpoints) {
    resultBytes.set(c, offset);
    offset += c.length;
  }

  return {
    challengeToken: challenge.challengeToken,
    solution: { checkpoints: bytesToBase64(resultBytes) }
  };
}

// Provision a new temporary preview account.
// Mirrors Wrangler's internal flow:
//   POST /provisioning/previews/challenge  -> PoW challenge
//   POST /provisioning/previews            -> account + apiToken + claim url
export async function provisionTemporaryAccount() {
  const challengeUrl = API + "/provisioning/previews/challenge";
  const previewUrl = API + "/provisioning/previews";

  // Step A: Request the challenge
  const r1 = await fetch(challengeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  if (!r1.ok) throw new Error(`Challenge request failed: ${r1.status}`);
  const r1Body = await r1.json();
  const challenge = r1Body.result;
  if (!challenge || !challenge.challengeToken) {
    throw new Error("Challenge response missing required fields");
  }

  // Step B: Solve the challenge
  const solution = await solveChallenge(challenge);

  // Step C: Post the solution to create the account
  const r2 = await fetch(previewUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      termsOfService: "https://www.cloudflare.com/terms/",
      privacyPolicy: "https://www.cloudflare.com/privacypolicy/",
      acceptTermsOfService: "yes",
      challengeToken: solution.challengeToken,
      solution: solution.solution
    })
  });

  if (!r2.ok) throw new Error(`Account provisioning failed: ${r2.status}`);
  const r2Body = await r2.json();
  const res = r2Body.result; // contains account: {id, apiToken, name, expiresAt}, claim: {url, expiresAt}

  return {
    accountId: res.account.id,
    apiToken: res.account.apiToken,
    accountName: res.account.name,
    claimUrl: res.claim.url,
    expiresAt: res.claim.expiresAt
  };
}
