import { signSession, setSessionCookie } from "../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const { password } = await request.json();

    if (!password) {
      return new Response(JSON.stringify({ ok: false, error: "Missing password" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    if (password !== env.ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid password" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    // vytvoříme payload BEZ exp (ten přidá signSession automaticky)
    const payload = {
      user: "admin"
    };

    // ⚠️ SPRÁVNÉ POŘADÍ PARAMETRŮ
    const token = await signSession(payload, env.SESSION_SECRET);

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "content-type": "application/json",
        "set-cookie": setSessionCookie(token),
      },
    });

  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Bad request",
      message: String(e?.message || e),
    }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
