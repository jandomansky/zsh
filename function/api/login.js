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

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: "Bad request" }), {
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }
}
