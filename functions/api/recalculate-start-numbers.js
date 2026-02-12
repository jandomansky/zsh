import { requireAuth } from "../_shared/auth";

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (auth instanceof Response) return auth;

  const { results } = await env.DB.prepare(`
    SELECT *
    FROM racers
    WHERE birth_date IS NOT NULL
  `).all();

  if (!results || !results.length) {
    return json({ ok: false, error: "No racers found." }, 400);
  }

  // 0) reset – ať přepočet vždy přepíše předchozí stav
  await env.DB.prepare(`UPDATE racers SET start_number = NULL`).run();

  // --- helpers ---
  const SKI_ORDER = ["Ž1", "Ž2", "M1", "M2", "M3"];
  const SNOW_ORDER = ["Ž", "M"];

  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replaceAll("lyze", "lyže"); // drobná pomoc pro případ bez diakritiky

  function hasSki(r) {
    // Pozor: disciplines je teď např. "Lyže, Biatlon"
    const d = norm(r.disciplines);
    return d.includes("lyže");
  }

  function hasSnow(r) {
    const d = norm(r.disciplines);
    return d.includes("snowboard") || d.includes("snow");
  }

  function hasBiat(r) {
    // někde můžeš mít i biatlon flag v DB, ale tady stačí disciplines
    const d = norm(r.disciplines);
    return d.includes("biat");
  }

  function skiRank(r) {
    const c = String(r.category_os || "").trim();
    const idx = SKI_ORDER.indexOf(c);
    return idx === -1 ? 999 : idx;
  }

  function snowRank(r) {
    // snowboard_cat ukládáš jako "M" / "Ž"
    const c = String(r.snowboard_cat || "").trim();
    const idx = SNOW_ORDER.indexOf(c);
    return idx === -1 ? 999 : idx;
  }

  function byOldestFirst(a, b) {
    return new Date(a.birth_date) - new Date(b.birth_date);
  }

  function byLastName(a, b) {
    const ln = String(a.last_name || "").localeCompare(String(b.last_name || ""), "cs", {
      sensitivity: "base",
    });
    if (ln !== 0) return ln;
    return String(a.first_name || "").localeCompare(String(b.first_name || ""), "cs", {
      sensitivity: "base",
    });
  }

  async function assignSorted(list, startNumber) {
    // Přidělí souvisle bez děr: vždy inkrementuje jen po úspěšném UPDATE
    for (const r of list) {
      await env.DB.prepare(`
        UPDATE racers
        SET start_number = ?
        WHERE id = ?
      `)
        .bind(startNumber, r.id)
        .run();

      startNumber++;
    }
    return startNumber;
  }

  // 1) LYŽE (včetně těch, co mají i snowboard/biatlon)
  const ski = results
    .filter((r) => hasSki(r))
    .slice()
    .sort((a, b) => {
      const ra = skiRank(a);
      const rb = skiRank(b);
      if (ra !== rb) return ra - rb;

      const age = byOldestFirst(a, b);
      if (age !== 0) return age;

      return byLastName(a, b);
    });

  let startNumber = 1;
  startNumber = await assignSorted(ski, startNumber);

  // 2) SNOWBOARD-only (ti, co nejsou v lyžích)
  const snowOnly = results
    .filter((r) => hasSnow(r) && !hasSki(r))
    .slice()
    .sort((a, b) => {
      const ra = snowRank(a);
      const rb = snowRank(b);
      if (ra !== rb) return ra - rb;

      const age = byOldestFirst(a, b);
      if (age !== 0) return age;

      return byLastName(a, b);
    });

  startNumber = await assignSorted(snowOnly, startNumber);

  // 3) BIATLON-only (bez lyží i snowboardu)
  const biatOnly = results
    .filter((r) => hasBiat(r) && !hasSki(r) && !hasSnow(r))
    .slice()
    .sort((a, b) => {
      const age = byOldestFirst(a, b);
      if (age !== 0) return age;
      return byLastName(a, b);
    });

  startNumber = await assignSorted(biatOnly, startNumber);

  // 4) FALLBACK: kdokoliv, kdo pořád nemá číslo (aby nikdy nevznikly díry)
  const assignedIds = new Set([
    ...ski.map((r) => String(r.id)),
    ...snowOnly.map((r) => String(r.id)),
    ...biatOnly.map((r) => String(r.id)),
  ]);

  const leftovers = results
    .filter((r) => !assignedIds.has(String(r.id)))
    .slice()
    .sort((a, b) => {
      const age = byOldestFirst(a, b);
      if (age !== 0) return age;
      return byLastName(a, b);
    });

  startNumber = await assignSorted(leftovers, startNumber);

  const totalAssigned = startNumber - 1;

  // Diagnostika: ověřit, že jsou čísla 1..N bez mezer
  const { results: nums } = await env.DB.prepare(`
    SELECT start_number
    FROM racers
    WHERE start_number IS NOT NULL
    ORDER BY start_number ASC
  `).all();

  const missing = [];
  const present = new Set(nums.map((x) => Number(x.start_number)));
  for (let i = 1; i <= totalAssigned; i++) {
    if (!present.has(i)) missing.push(i);
  }

  return json({
    ok: true,
    counts: {
      ski: ski.length,
      snowboard_only: snowOnly.length,
      biatlon_only: biatOnly.length,
      leftovers: leftovers.length,
      total_assigned: totalAssigned,
      total_racers: results.length,
    },
    integrity: {
      ok: missing.length === 0 && totalAssigned === results.length,
      missing_numbers: missing, // pokud by se někdy stalo, hned to uvidíš
    },
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
