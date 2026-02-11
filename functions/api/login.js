import { signSession, setSessionCookie } from "../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { password } = body || {};

    if (!password) {
      return new Response(JSON.stringify({ ok: false, error: "Missing password" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    if (password !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid password" }), {
        status: 401,
        headers: { "content-type": "application/json" }
      });
    }

    const token = await signSession(env, {
      sub: "admin",
      iat: Date.now(),
      exp: Date.now() + 12 * 60 * 60 * 1000,
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "content-type": "application/json",
        "set-cookie": setSessionCookie(token),
      }
    });

  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }
}
