import { getCookie, verifySession } from "../_shared/auth.js";

export async function onRequestGet({ request, env }) {
  const token = getCookie(request);
  const session = await verifySession(token, env.SESSION_SECRET);

  if (!session) {
    return new Response(JSON.stringify({ ok: false, authenticated: false }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, authenticated: true, session }), {
    headers: { "content-type": "application/json" },
  });
}
