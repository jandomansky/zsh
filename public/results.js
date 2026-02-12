document.addEventListener("DOMContentLoaded", () => {
  const elUpdated = document.getElementById("lastUpdated");
  const btnRefresh = document.getElementById("refreshBtn");

  const skiMen = document.getElementById("skiMen");
  const skiWomen = document.getElementById("skiWomen");
  const snowMen = document.getElementById("snowMen");
  const snowWomen = document.getElementById("snowWomen");

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function discTokensLower(raw) {
    return String(raw || "")
      .toLowerCase()
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
  }

  function hasDisc(r, key) {
    return discTokensLower(r.disciplines).includes(key);
  }

  // Parse "01:12.34" / "1:12.34" / "72.34" / "72" -> ms
  function parseTimeToMs(s) {
    const raw = String(s || "").trim();
    if (!raw) return null;

    // normalize decimal separator
    const t = raw.replace(",", ".");
    // mm:ss.xx
    const m = t.match(/^(\d{1,2})\s*:\s*(\d{1,2})(?:\.(\d{1,3}))?$/);
    if (m) {
      const mm = Number(m[1]);
      const ss = Number(m[2]);
      const frac = m[3] ? m[3].padEnd(3, "0").slice(0, 3) : "000";
      return (mm * 60 + ss) * 1000 + Number(frac);
    }

    // ss.xx or ss
    const m2 = t.match(/^(\d{1,4})(?:\.(\d{1,3}))?$/);
    if (m2) {
      const ss = Number(m2[1]);
      const frac = m2[2] ? m2[2].padEnd(3, "0").slice(0, 3) : "000";
      return ss * 1000 + Number(frac);
    }

    return null;
  }

  function msToDisplay(ms) {
    if (ms == null) return "—";
    const totalSec = Math.floor(ms / 1000);
    const mm = Math.floor(totalSec / 60);
    const ss = totalSec % 60;
    const frac = String(ms % 1000).padStart(3, "0").slice(0, 2); // 2 decimals
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${frac}`;
  }

  function fullName(r) {
    return `${r.last_name || ""} ${r.first_name || ""}`.trim();
  }

function calcBestMs(t1, t2) {
  const a = parseTimeToMs(t1);
  const b = parseTimeToMs(t2);

  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

  function sortByTotalAsc(a, b) {
    const aa = a.totalMs == null ? Number.POSITIVE_INFINITY : a.totalMs;
    const bb = b.totalMs == null ? Number.POSITIVE_INFINITY : b.totalMs;
    return aa - bb;
  }

  function makeGroupCard(title, rows, mode) {
    // mode: "ski" | "snow"
    const countDone = rows.filter(r => r.totalMs != null).length;

    const body = rows
      .slice()
      .sort(sortByTotalAsc)
      .map((r, idx) => {
        const t1 = mode === "ski" ? r.ski_time_1 : r.snowboard_time_1;
        const t2 = mode === "ski" ? r.ski_time_2 : r.snowboard_time_2;

        return `
          <tr>
            <td class="rank">${r.totalMs != null ? (idx + 1) : "—"}</td>
            <td>${esc(fullName(r))}</td>
            <td class="muted">${esc(r.team || "")}</td>
            <td>${esc(t1 || "—")}</td>
            <td>${esc(t2 || "—")}</td>
            <td class="best">${msToDisplay(r.totalMs)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="groupCard">
        <div class="groupHead">
          <h3>${esc(title)}</h3>
          <div class="groupMeta">Hotovo: ${countDone}/${rows.length}</div>
        </div>
        <div class="tableWrap">
          <table class="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Závodník</th>
                <th>Tým</th>
                <th>Čas 1</th>
                <th>Čas 2</th>
                <th>Nejlepší</th>
              </tr>
            </thead>
            <tbody>
              ${body || `<tr><td colspan="6" class="muted">Žádná data.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function fetchRacers() {
    const res = await fetch("/api/racers", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Fetch failed");
    return data.racers || [];
  }

  function renderAll(racers) {
    // SKI men: M1/M2/M3 (category_os)
    const skiMenCats = ["M1", "M2", "M3"];
    const skiWomenCats = ["Ž1", "Ž2"];

    // Snowboard: M / Ž (snowboard_cat)
    const snowMenCats = ["M"];
    const snowWomenCats = ["Ž"];

    // decorate: compute totals
   const decorated = racers.map(r => ({
  ...r,
  skiBestMs: calcBestMs(r.ski_time_1, r.ski_time_2),
  snowBestMs: calcBestMs(r.snowboard_time_1, r.snowboard_time_2),
}));

    // helper: filter by discipline + category
    const skiRowsByCat = (cat) =>
      decorated
        .filter(r => hasDisc(r, "lyže"))
        .filter(r => String(r.category_os || "").trim() === cat)
        .map(r => ({ ...r, totalMs: r.skiBestMs }));

    const snowRowsByCat = (cat) =>
      decorated
        .filter(r => hasDisc(r, "snowboard"))
        .filter(r => String(r.snowboard_cat || "").trim() === cat)
        .map(r => ({ ...r, totalMs: r.snowBestMs }));

    skiMen.innerHTML = skiMenCats
      .map(cat => makeGroupCard(`Kategorie ${cat}`, skiRowsByCat(cat), "ski"))
      .join("");

    skiWomen.innerHTML = skiWomenCats
      .map(cat => makeGroupCard(`Kategorie ${cat}`, skiRowsByCat(cat), "ski"))
      .join("");

    snowMen.innerHTML = snowMenCats
      .map(cat => makeGroupCard(`Kategorie ${cat}`, snowRowsByCat(cat), "snow"))
      .join("");

    snowWomen.innerHTML = snowWomenCats
      .map(cat => makeGroupCard(`Kategorie ${cat}`, snowRowsByCat(cat), "snow"))
      .join("");
  }

  async function refresh() {
    try {
      if (elUpdated) elUpdated.textContent = "Načítám…";
      const racers = await fetchRacers();
      renderAll(racers);
      const now = new Date();
      if (elUpdated) elUpdated.textContent = `Aktualizováno: ${now.toLocaleTimeString("cs-CZ")}`;
    } catch (e) {
      if (elUpdated) elUpdated.textContent = `Chyba: ${e.message}`;
      console.error(e);
    }
  }

  if (btnRefresh) btnRefresh.addEventListener("click", refresh);

  // start + auto refresh
  refresh();
  setInterval(refresh, 15000);
});
