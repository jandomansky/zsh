import { requireAuth } from "../_shared/auth";

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  await env.DB.prepare("DELETE FROM racers").run();

  return new Response(JSON.stringify({ ok: true, deleted: true }), {
    headers: { "content-type": "application/json" },
  });
}
