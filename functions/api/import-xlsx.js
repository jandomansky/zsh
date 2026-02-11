import * as XLSX from "../../vendor/xlsx.mjs";

const DECISION_DATE = new Date("2024-01-25");

// Excel serial -> Date, string -> Date
function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;

  // Already a Date
  if (value instanceof Date) return value;

  // Excel serial date number
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel epoch (1899-12-30) => Unix epoch offset 25569 days
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    const d = new Date(utcValue * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // String
  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

function calculateAge(birthDate) {
  let age = DECISION_DATE.getFullYear() - birthDate.getFullYear();
  const m = DECISION_DATE.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && DECISION_DATE.getDate() < birthDate.getDate())) age--;
  return age;
}

// Kategorie OS dle zadání (k datu 25.1.2024)
function categoryOS(gender, birthDate) {
  if (!birthDate || Number.isNaN(birthDate.getTime())) return null;

  // ženy
  if (gender === "F") {
    if (birthDate <= new Date("1983-01-25")) return "Ž1";
    return "Ž2";
  }

  // muži
  if (gender === "M") {
    if (birthDate <= new Date("1973-01-25")) return "M1";
    if (birthDate <= new Date("1988-01-25")) return "M2";
    return "M3";
  }

  return null;
}

// „Lacina Pavel“ -> { last_name: "Lacina", first_name: "Pavel" }
function splitName(fullName) {
  const raw = String(fullName || "").trim().replace(/\s+/g, " ");
  if (!raw) return null;
  const parts = raw.split(" ");
  if (parts.length === 1) return { last_name: parts[0], first_name: "" };
  return { last_name: parts[0], first_name: parts.slice(1).join(" ") };
}

// velmi hrubý odhad (když v XLSX není pohlaví)
// později klidně nahradíme explicitním sloupcem
function guessGender(firstName) {
  const fn = String(firstName || "").trim();
  if (!fn) return "M";
  // pozor: není to 100% (např. Nikita), ale pro start to stačí
  return fn.endsWith("a") ? "F" : "M";
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

    // Mapování na tvoje hlavičky
    const racers = rows
      .map(r => {
        const fullName = r["Závodník"];
        const team = r["Tým"];
        const birthDate = parseDate(r["dat. nar."]);
        const disciplines = r["Lyže"];

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
          category_os: categoryOS(gender, birthDate)
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

    // ✅ TADY je to správné místo:
    // smažeme stará data až ve chvíli, kdy víme, že máme validní nové řádky
    await env.DB.prepare("DELETE FROM racers").run();

    // Vložíme do DB (zatím vždy INSERT; deduplikaci uděláme později)
    // Pro rychlost použijeme batch (D1 umí batch)
    const statements = racers.map(r =>
      env.DB.prepare(`
        INSERT INTO racers (
          first_name, last_name, birth_date, gender,
          team, disciplines, category_os
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        r.first_name,
        r.last_name,
        r.birth_date,
        r.gender,
        r.team,
        r.disciplines,
        r.category_os
      )
    );

    await env.DB.batch(statements);

    return new Response(JSON.stringify({
      ok: true,
      inserted: racers.length
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
