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
  const age = calculateAge(birthDate);

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

    if (!file) {
      return new Response(JSON.stringify({ ok: false, error: "No file" }), {
        status: 400,
        headers: { "content-type": "application/json" }
      });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const racers = rows.map(r => {
      const birthDate = parseDate(r.birth_date || r["Birth Date"]);
      const gender = r.gender || r["Gender"];

      return {
        first_name: r.first_name || r["First Name"],
        last_name: r.last_name || r["Last Name"],
        birth_date: birthDate?.toISOString().slice(0, 10),
        gender,
        team: r.team || r["Team"],
        disciplines: r.disciplines || r["Disciplines"],
        category_os: categoryOS(gender, birthDate)
      };
    });

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
