import { requireAuth } from "../_shared/auth";

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const { results } = await env.DB.prepare(`
    SELECT *
    FROM racers
    WHERE birth_date IS NOT NULL
  `).all();

  if (!results.length) {
    return json({ ok: false, error: "No racers found." }, 400);
  }

  // 0) reset – ať přepočet vždy přepíše předchozí stav
  await env.DB.prepare(`UPDATE racers SET start_number = NULL`).run();

  // starší = menší datum → dostane menší startovní číslo
  const sortByAgeOldestFirst = (a, b) =>
    new Date(a.birth_date) - new Date(b.birth_date);

  let startNumber = 1;

  // --- helpery pro disciplíny ---
  const SKI_TOKENS = new Set(["M1", "M2", "M3", "Ž1", "Ž2"]);

  function normalizeDisciplines(raw) {
    // umožní "Ž1", "Ž1, biatlon", "M2; snow", "M3 / biat", atd.
    return String(raw || "")
      .split(/[,;/|]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  const isSki = (r) => {
    const tokens = normalizeDisciplines(r.disciplines);
    return tokens.some((t) => SKI_TOKENS.has(t));
  };

  const isSnowboard = (r) => {
    const s = String(r.disciplines || "").toLowerCase();
    return s.includes("snow") || s.includes("snowboard");
  };

  const isBiatlon = (r) => {
    const s = String(r.disciplines || "").toLowerCase();
    return s.includes("biat");
  };

  // skupiny pro lyže (v pořadí, které chceš)
  const ski = results.filter((r) => isSki(r));

  const assignGroup = async (group) => {
    group.sort(sortByAgeOldestFirst);
    for (const r of group) {
      await env.DB.prepare(`
        UPDATE racers
        SET start_number = ?
        WHERE id = ?
      `)
        .bind(startNumber, r.id)
        .run();

      startNumber++;
    }
  };

  // 1) Lyže: Ž1 -> Ž2 -> M1 -> M2 -> M3
  await assignGroup(ski.filter((r) => r.category_os === "Ž1"));
  await assignGroup(ski.filter((r) => r.category_os === "Ž2"));
  await assignGroup(ski.filter((r) => r.category_os === "M1"));
  await assignGroup(ski.filter((r) => r.category_os === "M2"));
  await assignGroup(ski.filter((r) => r.category_os === "M3"));

  const assignedInSki = startNumber - 1;

  // 2) Biatlon-only: jen ti, co nemají lyže ani snowboard
  const biatlonOnly = results
    .filter((r) => isBiatlon(r) && !isSki(r) && !isSnowboard(r))
    .sort(sortByAgeOldestFirst);

  for (const r of biatlonOnly) {
    await env.DB.prepare(`
      UPDATE racers
      SET start_number = ?
      WHERE id = ?
    `)
      .bind(startNumber, r.id)
      .run();

    startNumber++;
  }

  const assignedBiatlonOnly = biatlonOnly.length;
  const totalAssigned = startNumber - 1;

  return json({
    ok: true,
    assigned_in_ski: assignedInSki,
    assigned_biatlon_only: assignedBiatlonOnly,
    updated: totalAssigned,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
