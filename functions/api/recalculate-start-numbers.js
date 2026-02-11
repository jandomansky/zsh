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

  // Reset
  await env.DB.prepare(`UPDATE racers SET start_number = NULL`).run();

  // Starší = menší datum → menší startovní číslo
  const sortByAgeOldestFirst = (a, b) =>
    new Date(a.birth_date) - new Date(b.birth_date);

  let startNumber = 1;

  function discTokens(r) {
    return String(r.disciplines || "")
      .toLowerCase()
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  const hasSki = (r) => discTokens(r).includes("lyže");
  const hasSnowboard = (r) => discTokens(r).includes("snowboard");
  const hasBiatlon = (r) => Number(r.biatlon) === 1 || discTokens(r).includes("biatlon");

  const isWoman = (r) => String(r.snowboard_cat || r.category_os || "").startsWith("Ž");

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

  // 1) LYŽE: Ž1 -> Ž2 -> M1 -> M2 -> M3
  const skiRacers = results.filter((r) => hasSki(r) && r.category_os);

  await assignGroup(skiRacers.filter((r) => r.category_os === "Ž1"));
  await assignGroup(skiRacers.filter((r) => r.category_os === "Ž2"));
  await assignGroup(skiRacers.filter((r) => r.category_os === "M1"));
  await assignGroup(skiRacers.filter((r) => r.category_os === "M2"));
  await assignGroup(skiRacers.filter((r) => r.category_os === "M3"));

  const assignedInSki = startNumber - 1;

  // 2) SNOWBOARD: Ž -> M (kategorie jsou jen M/Ž a máš je v snowboard_cat)
  const snowboardRacers = results.filter((r) => hasSnowboard(r) && r.snowboard_cat);

  await assignGroup(snowboardRacers.filter((r) => String(r.snowboard_cat).trim() === "Ž"));
  await assignGroup(snowboardRacers.filter((r) => String(r.snowboard_cat).trim() === "M"));

  const assignedInSnowboard = startNumber - 1 - assignedInSki;

  // 3) BIATLON-ONLY: jen ti, co mají biatlon a nemají lyže ani snowboard
  const biatlonOnly = results
    .filter((r) => hasBiatlon(r) && !hasSki(r) && !hasSnowboard(r))
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
    assigned_in_snowboard: assignedInSnowboard,
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
