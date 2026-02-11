import * as XLSX from "../../vendor/xlsx.mjs";

// Excel serial -> Date, string -> Date
function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (value instanceof Date) return value;

  // Excel serial date
  if (typeof value === "number" && Number.isFinite(value)) {
    const utcDays = Math.floor(value - 25569);
    const utcValue = utcDays * 86400;
    const d = new Date(utcValue * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // string date
  const d = new Date(String(value).trim());
  return Number.isNaN(d.getTime()) ? null : d;
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

function norm(v) {
  return String(v ?? "").trim();
}

function biatlonYes(v) {
  return norm(v).toLowerCase() === "x";
}

function buildDisciplines(skiCat, snowboardCat, biatlon) {
  const out = [];
  if (skiCat) out.push("lyže");
  if (snowboardCat) out.push("snowboard");
  if (biatlon) out.push("biatlon");
  return out.join(", ");
}

export async function onRequestPost({ request, env }) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return json({ ok: false, error: "Missing XLSX file (field 'file')." }, 400);
    }

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const sheetName = wb.SheetNames?.[0];

    if (!sheetName) {
      return json({ ok: false, error: "XLSX has no sheets." }, 400);
    }

    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const racers = rows
      .map((r) => {
        const fullName = r["Závodník"];
        const team = norm(r["Tým"]) || null;
        const birthDate = parseDate(r["dat. nar."]);

        // XLSX disciplíny:
        // Lyže: M1/M2/M3/Ž1/Ž2 nebo prázdné
        // Snowboard: M/Ž nebo prázdné
        // Biatlon: "x" nebo prázdné
        const skiCat = norm(r["Lyže"]) || null;
        const snowboardCat = norm(r["Snowboard"]) || null;
        const biatlon = biatlonYes(r["Biatlon"]) ? 1 : 0;

        const nameParts = splitName(fullName);
        if (!nameParts || !birthDate) return null;

        const { first_name, last_name } = nameParts;
        const gender = guessGender(first_name);

        const disciplines = buildDisciplines(skiCat, snowboardCat, biatlon);

        return {
          first_name,
          last_name,
          birth_date: birthDate.toISOString().slice(0, 10),
          gender,
          team,
          // ✅ co závodí (slovně)
          disciplines: disciplines || null,
          // ✅ lyžařská kategorie (pro číslování lyží)
          category_os: skiCat,
          // ✅ snowboard kategorie (M/Ž)
          snowboard_cat: snowboardCat,
          // ✅ biatlon účast 1/0 (družstva)
          biatlon,
          // startovní číslo se bude počítat zvlášť
          start_number: null,
        };
      })
      .filter(Boolean);

    if (!racers.length) {
      return json(
        {
          ok: true,
          inserted: 0,
          warning:
            "No valid rows found. Check headers and required fields (Závodník, dat. nar.).",
        },
        200
      );
    }

    // smaž stará data (aby se nedublovalo)
    await env.DB.prepare("DELETE FROM racers").run();

    // vlož nové
    const statements = racers.map((r) =>
      env.DB.prepare(`
        INSERT INTO racers (
          first_name, last_name, birth_date, gender,
          team,
          disciplines,
          category_os,
          snowboard_cat,
          biatlon,
          start_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        r.first_name,
        r.last_name,
        r.birth_date,
        r.gender,
        r.team,
        r.disciplines,
        r.category_os,
        r.snowboard_cat,
        r.biatlon,
        r.start_number
      )
    );

    await env.DB.batch(statements);

    return json(
      {
        ok: true,
        inserted: racers.length,
        note:
          "Startovní čísla se nepřidělují při importu. Použij tlačítko „Přepočítat startovní čísla“.",
      },
      200
    );
  } catch (e) {
    return json(
      {
        ok: false,
        error: "Import failed",
        message: String(e?.message || e),
      },
      500
    );
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
