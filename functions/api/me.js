import { getCookie, verifySession } from "../_shared/auth.js";

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export async function onRequestGet({ request, env }) {
  try {
    const token = getCookie(request);
    const session = await verifySession(token, env.SESSION_SECRET);

    if (!session) return json({ ok: false, authenticated: false }, 401);

    return json({ ok: true, authenticated: true, session });
  } catch (e) {
    return json(
      { ok: false, error: "Internal error", message: String(e?.message || e) },
      500
    );
  }
}
