import { requireAuth } from "../_shared/auth";

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const { results } = await env.DB.prepare(`
    SELECT * FROM racers
    WHERE birth_date IS NOT NULL
  `).all();

  if (!results.length) {
    return json({ ok: false, error: "No racers found." }, 400);
  }

  // starší = menší datum → dostane menší startovní číslo
  const sortByAgeOldestFirst = (a, b) =>
    new Date(a.birth_date) - new Date(b.birth_date);

  let startNumber = 1;

  const isSki = (r) =>
    r.disciplines && r.disciplines.includes("M"); // dočasné (podle tvých dat)

  const isSnowboard = (r) =>
    r.disciplines && r.disciplines.toLowerCase().includes("snow");

  const isBiatlon = (r) =>
    r.disciplines && r.disciplines.toLowerCase().includes("biat");

  const womenSki = results.filter(
    (r) => r.category_os?.startsWith("Ž") && isSki(r)
  );
  const menSki = results.filter(
    (r) => r.category_os?.startsWith("M") && isSki(r)
  );

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

  // ====== POŘADÍ SKUPIN ======
  await assignGroup(womenSki.filter((r) => r.category_os === "Ž1"));
  await assignGroup(womenSki.filter((r) => r.category_os === "Ž2"));

  await assignGroup(menSki.filter((r) => r.category_os === "M1"));
  await assignGroup(menSki.filter((r) => r.category_os === "M2"));
  await assignGroup(menSki.filter((r) => r.category_os === "M3"));

  // ====== BIATLON navíc (jen ti bez lyží i snowboardu) ======
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

  return json({ ok: true, updated: startNumber - 1 });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
