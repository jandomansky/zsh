import { requireAuth } from "../_shared/auth";

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  // 1) vezmeme týmy, které mají alespoň jednoho biatlonistu
  const { results: teams } = await env.DB.prepare(`
    SELECT DISTINCT team
    FROM racers
    WHERE biatlon = 1 AND team IS NOT NULL AND team != ''
    ORDER BY team COLLATE NOCASE
  `).all();

  // 2) zajistíme existenci řádků v biathlon_teams
  const stmts = teams.map(t =>
    env.DB.prepare(`INSERT OR IGNORE INTO biathlon_teams(team) VALUES (?)`).bind(t.team)
  );
  if (stmts.length) await env.DB.batch(stmts);

  // 3) vrátíme týmy + uložený čas
  const { results } = await env.DB.prepare(`
    SELECT team, time
    FROM biathlon_teams
    ORDER BY team COLLATE NOCASE
  `).all();

  return json({ ok:true, teams: results, count: results.length });
}

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => null);
  if (!body) return json({ ok:false, error:"Invalid JSON" }, 400);

  const { team, time } = body;
  if (!team) return json({ ok:false, error:"Missing team" }, 400);

  await env.DB.prepare(`
    INSERT INTO biathlon_teams(team, time)
    VALUES(?, ?)
    ON CONFLICT(team) DO UPDATE SET time = excluded.time
  `).bind(team, time || null).run();

  return json({ ok:true });
}

function json(data, status=200){
  return new Response(JSON.stringify(data), { status, headers:{ "content-type":"application/json" } });
}
