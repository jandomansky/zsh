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
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  return new Uint8Array(sig);
}

export async function signSession(env, payloadObj) {
  const payload = new TextEncoder().encode(JSON.stringify(payloadObj));
  const sig = await hmac(env.SESSION_SECRET, payload);
  return `${b64url(payload)}.${b64url(sig)}`;
}

export async function verifySession(env, token) {
  if (!token || !token.includes(".")) return null;
  const [p, s] = token.split(".");
  const payloadBytes = b64urlToBytes(p);
  const sigBytes = b64urlToBytes(s);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.SESSION_SECRET),
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

export function setSessionCookie(token) {
  const maxAge = 60 * 60 * 12; // 12h
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}
