import * as XLSX from "../../vendor/xlsx.mjs";

const DECISION_DATE = new Date("2024-01-25");

// ✅ TADY NASTAV „ZADÁNÍ“ (pořadí kategorií / disciplín)
const CATEGORY_ORDER = ["M1", "M2", "M3", "Ž1", "Ž2"]; // uprav dle zadání
const DISCIPLINE_ORDER = ["M1", "M2", "M3", "Ž1", "Ž2"]; // u tebe to vypadá, že "Lyže" = např. M1/M2/...

function orderIndex(list, value) {
  const v = String(value ?? "").trim();
  const idx = list.indexOf(v);
  return idx === -1 ? 9999 : idx;
}

// Excel serial -> Date, string -> Date
function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value;

  if (typeof value === "number" && Number.isFinite(value)) {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    const d = new Date(utcValue * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function categoryOS(gender, birthDate) {
  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;

  if (gender === "F") {
    if (birthDate <= new Date("1983-01-25")) return "Ž1";
    return "Ž2";
  }

  if (gender === "M") {
    if (birthDate <= new Date("1973-01-25")) return "M1";
    if (birthDate <= new Date("1988-01-25")) return "M2";
    return "M3";
  }

  return null;
}

function splitName(fullName) {
  const raw = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!raw) return null;
  const parts = raw.split(" ");
  if (parts.length === 1) return { last_name: parts[0], first_name: "" };
  return { last_name: parts[0], first_name: parts.slice(1).join(" ") };
}

function guessGender(firstName) {
  const fn = String(firstName || "").trim();
  if (!fn) return "M";
  return fn.endsWith("a") ? "F" : "M";
}

// ✅ Seřadíme dle zadání a přidělíme start_number 1..N
function assignStartNumbers(racers) {
  racers.sort((a, b) => {
    // 1) kategorie OS
    const c1 = orderIndex(CATEGORY_ORDER, a.category_os);
    const c2 = orderIndex(CATEGORY_ORDER, b.category_os);
    if (c1 !== c2) return c1 - c2;

    // 2) disciplína (pokud je podle zadání relevantní)
    const d1 = orderIndex(DISCIPLINE_ORDER, a.disciplines);
    const d2 = orderIndex(DISCIPLINE_ORDER, b.disciplines);
    if (d1 !== d2) return d1 - d2;

    // 3) tým
    const t1 = String(a.team ?? "");
    const t2 = String(b.team ?? "");
    const tc = t1.localeCompare(t2, "cs", { sensitivity: "base" });
    if (tc !== 0) return tc;

    // 4) příjmení, jméno
    const ln = String(a.last_name ?? "").localeCompare(String(b.last_name ?? ""), "cs", { sensitivity: "base" });
    if (ln !== 0) return ln;

    const fn = String(a.first_name ?? "").localeCompare(String(b.first_name ?? ""), "cs", { sensitivity: "base" });
    if (fn !== 0) return fn;

    // 5) narození (stabilní tie-break)
    return String(a.birth_date ?? "").localeCompare(String(b.birth_date ?? ""));
  });

  for (let i = 0; i < racers.length; i++) {
    racers[i].start_number = i + 1;
  }
  return racers;
}

export async function onRequestPost({ request, env }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return new Response(JSON.stringify({ ok: false, error: "Missing XLSX file (field 'file')." }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) {
      return new Response(JSON.stringify({ ok: false, error: "XLSX has no sheets." }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    let racers = rows
      .map(r => {
        const fullName = r["Závodník"];
        const team = r["Tým"];
        const birthDate = parseDate(r["dat. nar."]);
        const disciplines = r["Lyže"]; // u tebe zatím vypadá jako M1/M2/M3/Ž1...

        const nameParts = splitName(fullName);
        if (!nameParts || !birthDate) return null;

        const { first_name, last_name } = nameParts;
        const gender = guessGender(first_name);

        return {
          first_name,
          last_name,
          birth_date: birthDate.toISOString().slice(0, 10),
          gender,
          team: String(team || "").trim() || null,
          disciplines: String(disciplines || "").trim() || null,
          category_os: categoryOS(gender, birthDate),
          start_number: null
        };
      })
      .filter(Boolean);

    if (!racers.length) {
      return new Response(JSON.stringify({
        ok: true,
        inserted: 0,
        warning: "No valid rows found. Check headers and required fields (Závodník, dat. nar.)."
      }), {
        headers: { "content-type": "application/json" }
      });
    }

    // ✅ přiděl startovní čísla dle zadání
    racers = assignStartNumbers(racers);

    // ✅ smaž stará data (aby se nedublovalo)
    await env.DB.prepare("DELETE FROM racers").run();

    // ✅ vlož nové
    const statements = racers.map(r =>
      env.DB.prepare(`
        INSERT INTO racers (
          first_name, last_name, birth_date, gender,
          team, disciplines, category_os, start_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        r.first_name,
        r.last_name,
        r.birth_date,
        r.gender,
        r.team,
        r.disciplines,
        r.category_os,
        r.start_number
      )
    );

    await env.DB.batch(statements);

    return new Response(JSON.stringify({
      ok: true,
      inserted: racers.length,
      start_numbers: { from: 1, to: racers.length }
    }), {
      headers: { "content-type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Import failed",
      message: String(e?.message || e)
    }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
