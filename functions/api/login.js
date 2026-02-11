// functions/api/login.js
import { signSession, setSessionCookie } from "../_shared/auth.js";

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders }
  });
}

async function readBody(request) {
  const ct = (request.headers.get("content-type") || "").toLowerCase();

  // JSON
  if (ct.includes("application/json")) {
    const body = await request.json().catch(() => ({}));
    return body || {};
  }

  // form-data fallback
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  }

  // text fallback (zkusíme JSON parse)
  const text = await request.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await readBody(request);
    const password = (body.password || "").toString();

    if (!password) return json({ ok: false, error: "Missing password" }, 400);

    if (!env.ADMIN_PASSWORD || String(env.ADMIN_PASSWORD).trim().length === 0) {
      return json({ ok: false, error: "ADMIN_PASSWORD missing in env" }, 500);
    }

    // Diagnostika: přesně tohle ti teď padalo (len=0)
    const secret = (env.SESSION_SECRET ?? "").toString();
    if (secret.trim().length < 16) {
      return json(
        { ok: false, error: "SESSION_SECRET missing/too short", len: secret.length },
        500
      );
    }

    if (password !== env.ADMIN_PASSWORD) {
      return json({ ok: false, error: "Invalid password" }, 401);
    }

    const token = await signSession({ user: "admin" }, String(secret));

    const cookie = [
      `session=${token}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Max-Age=604800" // 7 dní
    ].join("; ");

    return json({ ok: true }, 200, { "set-cookie": cookie });
  } catch (e) {
    return json(
      { ok: false, error: "Bad request", message: String(e?.message || e) },
      400
    );
  }
}
