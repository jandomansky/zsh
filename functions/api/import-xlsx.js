import * as XLSX from "../../vendor/xlsx.mjs";

const DECISION_DATE = new Date("2024-01-25");

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === "number") {
    // Excel serial
    const utc_days = Math.floor(value - 25569);
    const utc_value = utc_days * 86400;
    return new Date(utc_value * 1000);
  }

  return new Date(value);
}

function calculateAge(birthDate) {
  let age = DECISION_DATE.getFullYear() - birthDate.getFullYear();
  const m = DECISION_DATE.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && DECISION_DATE.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function categoryOS(gender, birthDate) {
  if (!birthDate || isNaN(birthDate.getTime())) {
    return null;
  }

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

export async function onRequestPost({ request, env }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);
return new Response(JSON.stringify({
  ok: true,
  sample: rows[0],
  headers: Object.keys(rows[0] || {})
}), {
  headers: { "content-type": "application/json" }
});

const racers = rows
  .map(r => {
    const fullName = r["Závodník"];
    const team = r["Tým"];
    const birthDate = parseDate(r["dat. nar."]);
    const disciplines = r["Lyže"];

    if (!fullName || !birthDate) return null;

    const parts = fullName.trim().split(" ");
    const first_name = parts.slice(1).join(" ");
    const last_name = parts[0];

    // Zkusíme odhadnout gender podle přípony
    let gender = "M";
    if (first_name.endsWith("a")) gender = "F";

    return {
      first_name,
      last_name,
      birth_date: birthDate.toISOString().slice(0, 10),
      gender,
      team,
      disciplines,
      category_os: categoryOS(gender, birthDate)
    };
  })
  .filter(Boolean);

    // zatím bez startovních čísel
    const inserted = [];

    for (const r of racers) {
      await env.DB.prepare(`
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
      ).run();

      inserted.push(r);
    }

    return new Response(JSON.stringify({
      ok: true,
      inserted: inserted.length
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
