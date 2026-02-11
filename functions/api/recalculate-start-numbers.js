import { requireAuth } from "../_shared/auth";

export async function onRequestPost({ request, env }) {
  await requireAuth(request, env);

  const { results } = await env.DB.prepare(`
    SELECT * FROM racers
    WHERE birth_date IS NOT NULL
  `).all();

  if (!results.length) {
    return json({ ok: false, error: "No racers found." }, 400);
  }

  // pomocná funkce
  const sortByAgeDesc = (a, b) =>
    new Date(a.birth_date) - new Date(b.birth_date); 
  // starší = menší datum → dostane menší číslo

  let startNumber = 1;

  const assigned = new Set();

  const isSki = r =>
    r.disciplines && r.disciplines.includes("M");

  const isSnowboard = r =>
    r.disciplines && r.disciplines.toLowerCase().includes("snow");

  const isBiatlon = r =>
    r.disciplines && r.disciplines.toLowerCase().includes("biat");

  const women = results.filter(r => r.category_os?.startsWith("Ž") && isSki(r));
  const men = results.filter(r => r.category_os?.startsWith("M") && isSki(r));

  const assignGroup = async group => {
    group.sort(sortByAgeDesc);
    for (const r of group) {
      await env.DB.prepare(`
        UPDATE racers SET start_number = ? WHERE id = ?
      `).bind(startNumber, r.id).run();

      assigned.add(r.id);
      startNumber++;
    }
  };

  // ====== POŘADÍ SKUPIN ======

  await assignGroup(women.filter(r => r.category_os === "Ž1"));
  await assignGroup(women.filter(r => r.category_os === "Ž2"));

  await assignGroup(men.filter(r => r.category_os === "M1"));
  await assignGroup(men.filter(r => r.category_os === "M2"));
  await assignGroup(men.filter(r => r.category_os === "M3"));

  // ====== BIATLON navíc ======

  const biatlonOnly = results.filter(r =>
    isBiatlon(r) &&
    !isSki(r) &&
    !isSnowboard(r)
  );

  biatlonOnly.sort(sortByAgeDesc);

  for (const r of biatlonOnly) {
    await env.DB.prepare(`
      UPDATE racers SET start_number = ? WHERE id = ?
    `).bind(startNumber, r.id).run();

    startNumber++;
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
