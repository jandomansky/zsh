document.addEventListener("DOMContentLoaded", () => {
  console.log("admin.js loaded");

  const loginCard = document.getElementById("loginCard");
  const adminCard = document.getElementById("adminCard");
  const logoutBtn = document.getElementById("logoutBtn");

  const loginForm = document.getElementById("loginForm");
  const passwordEl = document.getElementById("password");
  const loginMsg = document.getElementById("loginMsg");
const statusPill = document.getElementById("statusPill");
  const deleteBtn = document.getElementById("deleteBtn");
  const racersBody = document.getElementById("racersBody");
  const racersMsg = document.getElementById("racersMsg");

  const xlsxFile = document.getElementById("xlsxFile");
  const importBtn = document.getElementById("importBtn");
  const importMsg = document.getElementById("importMsg");

  const tabSki = document.getElementById("tabSki");
  const tabSnow = document.getElementById("tabSnow");
  const tabBiat = document.getElementById("tabBiat");
  const tabAll = document.getElementById("tabAll");

  const panelSki = document.getElementById("panelSki");
  const panelSnow = document.getElementById("panelSnow");
  const panelBiat = document.getElementById("panelBiat");
  const panelAll = document.getElementById("panelAll");

  const skiBody = document.getElementById("skiBody");
  const snowBody = document.getElementById("snowBody");
  const biatBody = document.getElementById("biatBody");

  const skiMsg = document.getElementById("skiMsg");
  const snowMsg = document.getElementById("snowMsg");
  const biatMsg = document.getElementById("biatMsg");

  const recalculateBtn = document.getElementById("recalculateBtn");

  // ======= STATE =======
  const state = { racers: [] };

  function setMsg(text, ok = false) {
    if (!loginMsg) return;
    loginMsg.textContent = text;
    loginMsg.className = "msg " + (ok ? "ok" : "bad");
  }

  async function api(url, opts = {}) {
    const res = await fetch(url, {
      credentials: "include",
      ...opts,
      headers: {
        ...(opts.headers || {}),
      },
    });

    const ct = res.headers.get("content-type") || "";
    const isJson = ct.includes("application/json");
    const data = isJson
      ? await res.json().catch(() => null)
      : await res.text().catch(() => null);

    if (!res.ok) {
      const msg =
        (data && data.error) ? data.error :
        (typeof data === "string" && data) ? data :
        `HTTP ${res.status}`;
      throw new Error(msg);
    }

    return data;
  }

function showAdmin() {
  if (loginCard) loginCard.hidden = true;
  if (adminCard) adminCard.hidden = false;
  if (logoutBtn) logoutBtn.hidden = false;
  if (statusPill) statusPill.hidden = false;
  loadRacers();
}

function showLogin() {
  if (loginCard) loginCard.hidden = false;
  if (adminCard) adminCard.hidden = true;
  if (logoutBtn) logoutBtn.hidden = true;
  if (statusPill) statusPill.hidden = true;
}


  async function checkAuth() {
    try {
      const me = await api("/api/me");
      if (me.authenticated) showAdmin();
      else showLogin();
    } catch (e) {
      console.warn("checkAuth failed:", e);
      showLogin();
    }
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // ======= Disciplíny / Kategorie (nový model) =======
  function discTokensLower(raw) {
    return String(raw || "")
      .toLowerCase()
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function hasDisc(r, key) {
    return discTokensLower(r.disciplines).includes(key);
  }

  function displayDisciplines(r) {
    const out = [];
    if (hasDisc(r, "lyže")) out.push("Lyže");
    if (hasDisc(r, "snowboard")) out.push("Snowboard");
    if (hasDisc(r, "biatlon") || Number(r.biatlon) === 1) out.push("Biatlon");
    return out.join(", ");
  }

  function displayCategories(r) {
  const out = [];

  // Lyže → M1 / M2 / M3 / Ž1 / Ž2
  if (hasDisc(r, "lyže") && r.category_os) {
    out.push(String(r.category_os).trim());
  }

  // Snowboard → M / Ž
  if (hasDisc(r, "snowboard") && r.snowboard_cat) {
    out.push(String(r.snowboard_cat).trim());
  }

  // Biatlon → Bi
  if (hasDisc(r, "biatlon") || Number(r.biatlon) === 1) {
    out.push("Bi");
  }

  // odstranění duplicit + spojení
  return [...new Set(out)].join(", ");
}


  function renderRacers(rows) {
    if (!racersBody) return;
    racersBody.innerHTML = (rows || [])
      .map((r) => {
        const disc = displayDisciplines(r);
        const cats = displayCategories(r);

        return `
          <tr>
            <td>${esc(r.last_name)}</td>
            <td>${esc(r.first_name)}</td>
            <td>${esc(r.birth_date)}</td>
            <td>${esc(r.team)}</td>
            <td>${esc(disc)}</td>
            <td>${esc(cats)}</td>
            <td>${esc(r.start_number)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function byStart(a, b) {
    const aa = Number(a.start_number ?? 999999);
    const bb = Number(b.start_number ?? 999999);
    return aa - bb;
  }

  function fullName(r) {
    return `${r.last_name || ""} ${r.first_name || ""}`.trim();
  }

  function renderSkiPanel() {
    if (!skiBody) return;

    const rows = state.racers
      .filter((r) => String(r.disciplines || "").toLowerCase().includes("lyže"))
      .slice()
      .sort(byStart);

    skiBody.innerHTML = rows
      .map(
        (r) => `
      <tr>
        <td><b>${esc(r.start_number)}</b></td>
        <td>${esc(fullName(r))}</td>
        <td>${esc(r.birth_date)}</td>
        <td>${esc(r.team)}</td>
        <td>${esc(r.category_os || "")}</td>
        <td><input class="inputTime" data-id="${esc(r.id)}" data-d="ski" data-k="1" value="${esc(r.ski_time_1 || "")}" placeholder="např. 01:12.34"></td>
        <td><input class="inputTime" data-id="${esc(r.id)}" data-d="ski" data-k="2" value="${esc(r.ski_time_2 || "")}" placeholder="např. 01:12.34"></td>
        <td><button class="btn smallBtn" data-save="1" data-id="${esc(r.id)}" data-d="ski" type="button">Uložit</button></td>
      </tr>
    `
      )
      .join("");

    if (skiMsg) skiMsg.textContent = `Lyže: ${rows.length}`;
  }

// --- Snowboard řazení: Ženy (nejstarší->nejmladší), pak Muži (nejstarší->nejmladší) ---
function genderSnow(r) {
  // primárně snowboard_cat ("Ž" / "M"), fallback na category_os
  const sc = String(r.snowboard_cat || "").trim();
  if (sc === "Ž" || sc === "M") return sc;

  const os = String(r.category_os || "").trim();
  return os.startsWith("Ž") ? "Ž" : "M";
}

function byGenderThenAgeSnow(a, b) {
  const ga = genderSnow(a);
  const gb = genderSnow(b);

  // ženy první
  if (ga !== gb) return ga === "Ž" ? -1 : 1;

  // starší první = menší datum narození
  const da = new Date(a.birth_date || "9999-12-31").getTime();
  const db = new Date(b.birth_date || "9999-12-31").getTime();
  if (da !== db) return da - db;

  // stabilní dořazení (aby to neskákalo)
  const la = String(a.last_name || "").localeCompare(String(b.last_name || ""), "cs", { sensitivity: "base" });
  if (la !== 0) return la;

  return String(a.first_name || "").localeCompare(String(b.first_name || ""), "cs", { sensitivity: "base" });
}

function renderSnowPanel() {
  if (!snowBody) return;

  const rows = state.racers
    .filter((r) => String(r.disciplines || "").toLowerCase().includes("snowboard"))
    .slice()
    .sort(byGenderThenAgeSnow);

  snowBody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td><b>${esc(r.start_number)}</b></td>
        <td>${esc(fullName(r))}</td>
        <td>${esc(r.birth_date)}</td>
        <td>${esc(r.team)}</td>
        <td>${esc(r.snowboard_cat || "")}</td>
        <td><input class="inputTime" data-id="${esc(r.id)}" data-d="snowboard" data-k="1" value="${esc(r.snowboard_time_1 || "")}" placeholder="např. 01:12.34"></td>
        <td><input class="inputTime" data-id="${esc(r.id)}" data-d="snowboard" data-k="2" value="${esc(r.snowboard_time_2 || "")}" placeholder="např. 01:12.34"></td>
        <td><button class="btn smallBtn" data-save="1" data-id="${esc(r.id)}" data-d="snowboard" type="button">Uložit</button></td>
      </tr>
    `
    )
    .join("");

  if (snowMsg) snowMsg.textContent = `Snowboard: ${rows.length}`;
}


  function cssEscapeSafe(value) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  async function loadBiatTeams() {
    if (!biatBody) return;
    if (biatMsg) biatMsg.textContent = "Načítám týmy…";

    try {
      const data = await api("/api/biathlon-teams");
      const teams = data.teams || [];

      biatBody.innerHTML = teams
        .map(
          (t) => `
        <tr>
          <td><b>${esc(t.team)}</b></td>
          <td><input class="inputTime" data-team="${esc(t.team)}" value="${esc(t.time || "")}" placeholder="např. 12:34.56"></td>
          <td><button class="btn smallBtn" data-biat-save="1" data-team="${esc(t.team)}" type="button">Uložit</button></td>
        </tr>
      `
        )
        .join("");

      if (biatMsg) biatMsg.textContent = `Biatlon týmy: ${teams.length}`;
    } catch (e) {
      if (biatMsg) biatMsg.textContent = "Chyba: " + e.message;
    }
  }

  // ======= TABY =======
  function setActiveTab(which) {
    const map = [
      ["ski", tabSki, panelSki],
      ["snow", tabSnow, panelSnow],
      ["biat", tabBiat, panelBiat],
      ["all", tabAll, panelAll],
    ];

    for (const [key, btn, panel] of map) {
      if (btn) btn.classList.toggle("active", key === which);
      if (panel) panel.hidden = key !== which;
    }

    if (which === "ski") renderSkiPanel();
    if (which === "snow") renderSnowPanel();
    if (which === "biat") loadBiatTeams();
    if (which === "all") renderRacers(state.racers);
  }

  if (tabSki) tabSki.addEventListener("click", () => setActiveTab("ski"));
  if (tabSnow) tabSnow.addEventListener("click", () => setActiveTab("snow"));
  if (tabBiat) tabBiat.addEventListener("click", () => setActiveTab("biat"));
  if (tabAll) tabAll.addEventListener("click", () => setActiveTab("all"));

  // ======= LOAD RACERS =======
  async function loadRacers() {
    if (racersMsg) racersMsg.textContent = "Načítám…";
    try {
      const data = await api("/api/racers");
      state.racers = data.racers || [];

      // přehled vyplňujeme jen v tabu "all", ale data si držíme vždy
      if (tabAll?.classList.contains("active")) renderRacers(state.racers);

      if (racersMsg) racersMsg.textContent = `Načteno: ${data.count || 0}`;

      // překresli aktivní panel
      if (tabAll?.classList.contains("active")) renderRacers(state.racers);
      else if (tabSnow?.classList.contains("active")) renderSnowPanel();
      else if (tabBiat?.classList.contains("active")) loadBiatTeams();
      else renderSkiPanel();
    } catch (e) {
      if (racersMsg) racersMsg.textContent = "Chyba načítání: " + e.message;
    }
  }

  // ======= LOGIN =======
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setMsg("Přihlašuji…", true);

      try {
        await api("/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password: passwordEl?.value || "" }),
        });

        if (passwordEl) passwordEl.value = "";
        setMsg("Přihlášeno.", true);
await checkAuth();
setActiveTab("all");
      } catch (e) {
        setMsg("Chyba: " + (e?.message || e), false);
      }
    });
  }

  // ======= LOGOUT (UI only) =======
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      showLogin();
      setMsg("Odhlášení: zatím nemáme endpoint, session vyprší sama.", false);
    });
  }

  // ======= SMAZAT ZÁVODNÍKY =======
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const ok = confirm("Opravdu smazat všechny závodníky? Tuto akci nelze vrátit.");
      if (!ok) return;

      deleteBtn.disabled = true;
      if (racersMsg) racersMsg.textContent = "Mažu…";

      try {
        await api("/api/delete-racers", { method: "POST" });

        state.racers = [];
        renderSkiPanel();
        renderSnowPanel();
        if (tabAll?.classList.contains("active")) renderRacers([]);

        if (racersMsg) racersMsg.textContent = "Smazáno. Čekám na nový XLSX import.";
        if (xlsxFile) xlsxFile.value = "";
        if (importMsg) importMsg.textContent = "";
      } catch (e) {
        if (racersMsg) racersMsg.textContent = "Chyba mazání: " + (e?.message || e);
      } finally {
        deleteBtn.disabled = false;
      }
    });
  }

  // ======= RECALCULATE =======
  if (recalculateBtn) {
    recalculateBtn.addEventListener("click", async () => {
      recalculateBtn.disabled = true;
      if (racersMsg) racersMsg.textContent = "Přepočítávám startovní čísla…";

      try {
        const data = await api("/api/recalculate-start-numbers", { method: "POST" });
        console.log("recalculate ok:", data);
        if (racersMsg) racersMsg.textContent = "Hotovo ✅ Startovní čísla přepočítána.";
        await loadRacers();
      } catch (e) {
        console.error("recalculate error:", e);
        if (racersMsg) racersMsg.textContent = "Chyba přepočtu: " + (e?.message || e);
      } finally {
        recalculateBtn.disabled = false;
      }
    });
  }

  // ======= IMPORT XLSX =======
  if (importBtn) {
    importBtn.addEventListener("click", async () => {
      if (!xlsxFile || !xlsxFile.files || !xlsxFile.files.length) {
        if (importMsg) importMsg.textContent = "Vyber XLSX soubor.";
        return;
      }

      const formData = new FormData();
      formData.append("file", xlsxFile.files[0]);

      if (importMsg) importMsg.textContent = "Importuji…";
      importBtn.disabled = true;

      try {
        const res = await fetch("/api/import-xlsx", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Import failed");

        if (importMsg) importMsg.textContent = `Import OK. Vloženo: ${data.inserted}`;
        await loadRacers();
      } catch (e) {
        if (importMsg) importMsg.textContent = "Chyba: " + e.message;
      } finally {
        importBtn.disabled = false;
      }
    });
  }

  // ======= ULOŽENÍ ČASŮ (delegace) =======
  document.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-save='1']");
    if (!btn) return;

    const id = btn.getAttribute("data-id");
    const discipline = btn.getAttribute("data-d"); // "ski" | "snowboard"

    const t1 = document.querySelector(
      `input.inputTime[data-id="${cssEscapeSafe(id)}"][data-d="${discipline}"][data-k="1"]`
    )?.value || "";

    const t2 = document.querySelector(
      `input.inputTime[data-id="${cssEscapeSafe(id)}"][data-d="${discipline}"][data-k="2"]`
    )?.value || "";

    btn.disabled = true;
    try {
      await api("/api/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          discipline,
          time1: t1.trim() || null,
          time2: t2.trim() || null,
        }),
      });

      const r = state.racers.find((x) => String(x.id) === String(id));
      if (r) {
        if (discipline === "ski") {
          r.ski_time_1 = t1;
          r.ski_time_2 = t2;
        } else if (discipline === "snowboard") {
          r.snowboard_time_1 = t1;
          r.snowboard_time_2 = t2;
        }
      }
    } catch (err) {
      alert("Chyba ukládání: " + (err?.message || err));
    } finally {
      btn.disabled = false;
    }
  });

  document.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("button[data-biat-save='1']");
    if (!btn) return;

    const team = btn.getAttribute("data-team");
    const inp = document.querySelector(
      `input.inputTime[data-team="${cssEscapeSafe(team)}"]`
    );
    const time = inp?.value || "";

    btn.disabled = true;
    try {
      await api("/api/biathlon-teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ team, time: time.trim() || null }),
      });
    } catch (err) {
      alert("Chyba ukládání: " + (err?.message || err));
    } finally {
      btn.disabled = false;
    }
  });

  // start
  checkAuth();

  // default tab
  setActiveTab("all");
});
