const COOKIE_NAME = "zsh_session";

function b64url(bytes) {
  let str = btoa(String.fromCharCode(...bytes));
  return str.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64urlToBytes(s) {
  s = s.replaceAll("-", "+").replaceAll("_", "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(secret, dataBytes) {
  const sec = (secret ?? "").toString();
  if (!sec) throw new Error("SESSION_SECRET missing/empty");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sec),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  return new Uint8Array(sig);
}

// ✅ API: signSession(payloadObj, secret)
export async function signSession(payloadObj, secret, maxAgeSec = 60 * 60 * 12) {
  const exp = Date.now() + maxAgeSec * 1000;
  const payload = new TextEncoder().encode(JSON.stringify({ ...payloadObj, exp }));
  const sig = await hmac(secret, payload);
  return `${b64url(payload)}.${b64url(sig)}`;
}

// ✅ API: verifySession(token, secret)
export async function verifySession(token, secret) {
  if (!token || !token.includes(".")) return null;

  const [p, s] = token.split(".");
  const payloadBytes = b64urlToBytes(p);
  const sigBytes = b64urlToBytes(s);

  const sec = (secret ?? "").toString();
  if (!sec) return null;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sec),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const ok = await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
  if (!ok) return null;

  const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  if (payload.exp && Date.now() > payload.exp) return null;

  return payload;
}

export function getCookie(request, name = COOKIE_NAME) {
  const h = request.headers.get("cookie") || "";
  const parts = h.split(";").map(v => v.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

export function setSessionCookie(token, maxAgeSec = 60 * 60 * 12) {
  return [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${maxAgeSec}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax"
  ].join("; ");
}

// ✅ API: requireAuth(request, env)
// Vrací session payload, nebo Response 401
export async function requireAuth(request, env) {
  const token = getCookie(request, COOKIE_NAME);
  const session = await verifySession(token, env?.SESSION_SECRET);
  if (!session) return unauthorized();
  return session;
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" }
  });
}
