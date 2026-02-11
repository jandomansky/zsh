import { signSession } from "../_shared/auth.js";

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json().catch(() => ({}));
    const password = body?.password;

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

    const token = await signSession({ user: "admin" }, env.SESSION_SECRET);

    // cookie pro Pages: SameSite=Lax stačí, Secure povinné na https
    const cookie = [
      `session=${token}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Max-Age=604800" // 7 dní
    ].join("; ");

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        "content-type": "application/json",
        "set-cookie": cookie
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "Bad request", message: String(e?.message || e) }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }
}
