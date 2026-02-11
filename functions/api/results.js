import { requireAuth } from "../_shared/auth";

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  if (!body) return json({ ok:false, error:"Invalid JSON" }, 400);

  const { id, discipline, time1, time2 } = body;

  if (!id || !discipline) return json({ ok:false, error:"Missing id/discipline" }, 400);

  if (discipline === "ski") {
    await env.DB.prepare(`
      UPDATE racers
      SET ski_time_1 = ?, ski_time_2 = ?
      WHERE id = ?
    `).bind(time1 || null, time2 || null, id).run();
    return json({ ok:true });
  }

  if (discipline === "snowboard") {
    await env.DB.prepare(`
      UPDATE racers
      SET snowboard_time_1 = ?, snowboard_time_2 = ?
      WHERE id = ?
    `).bind(time1 || null, time2 || null, id).run();
    return json({ ok:true });
  }

  return json({ ok:false, error:"Unknown discipline" }, 400);
}

function json(data, status=200){
  return new Response(JSON.stringify(data), { status, headers:{ "content-type":"application/json" } });
}
