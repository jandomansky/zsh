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

  // Reset – ať přepočet vždy přepíše předchozí stav
  await env.DB.prepare(`UPDATE racers SET start_number = NULL`).run();

  // Starší = menší datum → dostane menší startovní číslo
  const sortByAgeOldestFirst = (a, b) =>
    new Date(a.birth_date) - new Date(b.birth_date);

  let startNumber = 1;

  // --- helpery pro disciplíny (nový model: "lyže, snowboard, biatlon") ---
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

  // Lyže závodníci = mají lyže a zároveň mají category_os (M1/M2/M3/Ž1/Ž2)
  const skiRacers = results.filter((r) => hasSki(r) && r.category_os);

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

  // 1) Lyže: Ž1 -> Ž2 -> M1 -> M2 -> M3 (od nejstaršího v každé skupině)
  await assignGroup(skiRacers.filter((r) => r.category_os === "Ž1"));
  await assignGroup(skiRacers.filter((r) => r.category_os === "Ž2"));
  await assignGroup(skiRacers.filter((r) => r.category_os === "M1"));
  await assignGroup(skiRacers.filter((r) => r.category_os === "M2"));
  await assignGroup(skiRacers.filter((r) => r.category_os === "M3"));

  const assignedInSki = startNumber - 1;

  // 2) Biatlon-only: jen ti, co mají biatlon a nemají lyže ani snowboard
  // (řazení od nejstaršího)
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
