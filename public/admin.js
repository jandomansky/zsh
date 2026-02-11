document.addEventListener("DOMContentLoaded", () => {
  console.log("admin.js loaded");

  const loginCard = document.getElementById("loginCard");
  const adminCard = document.getElementById("adminCard");
  const logoutBtn = document.getElementById("logoutBtn");

  const loginForm = document.getElementById("loginForm");
  const passwordEl = document.getElementById("password");
  const loginMsg = document.getElementById("loginMsg");

  const reloadBtn = document.getElementById("reloadBtn");
  const racersBody = document.getElementById("racersBody");
  const racersMsg = document.getElementById("racersMsg");

  const xlsxFile = document.getElementById("xlsxFile");
  const importBtn = document.getElementById("importBtn");
  const importMsg = document.getElementById("importMsg");

  const recalculateBtn = document.getElementById("recalculateBtn");

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
    loadRacers();
  }

  function showLogin() {
    if (loginCard) loginCard.hidden = false;
    if (adminCard) adminCard.hidden = true;
    if (logoutBtn) logoutBtn.hidden = true;
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

  function toTitleDisciplines(s) {
  const t = String(s || "").toLowerCase().split(",").map(x => x.trim()).filter(Boolean);
  const out = [];
  if (t.includes("lyže")) out.push("Lyže");
  if (t.includes("snowboard")) out.push("Snowboard");
  if (t.includes("biatlon")) out.push("Biatlon");
  return out.join(", ");
}

function displayCategories(r) {
  const out = [];

  // lyže kategorie (M1/M2/M3/Ž1/Ž2) jen pokud opravdu závodí v lyžích
  const disc = String(r.disciplines || "").toLowerCase();
  const hasSki = disc.includes("lyže");

  if (hasSki && r.category_os) out.push(String(r.category_os).trim());

  // snowboard kategorie je jen M nebo Ž, jen pokud závodí ve snowboardu
  const hasSnow = disc.includes("snowboard");
  if (hasSnow && r.snowboard_cat) out.push(String(r.snowboard_cat).trim());

  // biatlon je družstev → kategorii nepřidáváme

  return [...new Set(out)].join(", ");
}

function tokensLower(raw) {
  return String(raw || "")
    .toLowerCase()
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
}

function hasDisc(r, key) {
  return tokensLower(r.disciplines).includes(key);
}

function displayDisciplines(r) {
  const out = [];
  if (hasDisc(r, "lyže")) out.push("Lyže");
  if (hasDisc(r, "snowboard")) out.push("Snowboard");
  if (hasDisc(r, "biatlon")) out.push("Biatlon");
  return out.join(", ");
}

function displayCategories(r) {
  const out = [];

  // Lyže → věková/pohlavní kategorie M1/M2/M3/Ž1/Ž2 (uložené v category_os)
  if (hasDisc(r, "lyže") && r.category_os) {
    out.push(String(r.category_os).trim());
  }

  // Snowboard → jen M nebo Ž (uložené v snowboard_cat)
  if (hasDisc(r, "snowboard") && r.snowboard_cat) {
    out.push(String(r.snowboard_cat).trim());
  }

  // Biatlon je družstev → kategorie se nevypisuje

  // odstraní duplicity
  return [...new Set(out)].join(", ");
}
  
  function renderRacers(rows) {
  racersBody.innerHTML = rows.map(r => {
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
  }).join("");
}

function tokens(raw) {
  // dovolí "Ž1", "Ž1, biatlon", "M2; snow", "M3 / biat"
  return String(raw || "")
    .split(/[,;/|]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

function genderFromRow(r) {
  // primárně z category_os (u tebe vždy existuje)
  return String(r.category_os || "").startsWith("Ž") ? "Ž" : "M";
}

function hasSki(r) {
  const SKI_CATS = new Set(["M1", "M2", "M3", "Ž1", "Ž2"]);
  const t = tokens(r.disciplines);
  return t.some(x => SKI_CATS.has(x)) || SKI_CATS.has(String(r.category_os || "").trim());
}

function hasSnowboard(r) {
  const s = String(r.disciplines || "").toLowerCase();
  return s.includes("snow");
}

function hasBiatlon(r) {
  const s = String(r.disciplines || "").toLowerCase();
  return s.includes("biat");
}

function tokens(raw) {
  return String(raw || "")
    .toLowerCase()
    .split(/[,;/|]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

function genderFromRow(r) {
  return String(r.category_os || "").startsWith("Ž") ? "Ž" : "M";
}

function displayDisciplines(r) {
  const t = tokens(r.disciplines);
  const out = [];

  if (t.includes("lyže")) out.push("Lyže");
  if (t.includes("snowboard")) out.push("Snowboard");
  if (t.includes("biatlon")) out.push("Biatlon");

  return out.join(", ");
}

function displayCategories(r) {
  const t = tokens(r.disciplines);
  const out = [];
  const catOS = String(r.category_os || "").trim();
  const gender = genderFromRow(r);

  // Lyže → věková kategorie
  if (t.includes("lyže") && catOS) {
    out.push(catOS);
  }

  // Snowboard → jen M / Ž
  if (t.includes("snowboard")) {
    out.push(gender);
  }

  // Biatlon → stejná kat. jako OS (pokud chcete jinak, upravíme)
  if (t.includes("biatlon") && catOS) {
    out.push(catOS);
  }

  // odstraní duplicity
  return [...new Set(out)].join(", ");
}



  async function loadRacers() {
    if (racersMsg) racersMsg.textContent = "Načítám…";
    try {
      const data = await api("/api/racers");
      renderRacers(data.racers || []);
      if (racersMsg) racersMsg.textContent = `Načteno: ${data.count || 0}`;
    } catch (e) {
      if (racersMsg) racersMsg.textContent = "Chyba načítání: " + e.message;
    }
  }

  // --- LOGIN ---
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
      } catch (e) {
        setMsg("Chyba: " + (e?.message || e), false);
      }
    });
  } else {
    console.error("loginForm not found");
  }

  // --- LOGOUT (UI only) ---
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      showLogin();
      setMsg("Odhlášení: zatím nemáme endpoint, session vyprší sama.", false);
    });
  }

  // --- RELOAD ---
  if (reloadBtn) reloadBtn.addEventListener("click", loadRacers);

  // --- RECALCULATE ---
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

  // --- IMPORT XLSX ---
  if (importBtn) {
    importBtn.addEventListener("click", async () => {
      if (!xlsxFile || !xlsxFile.files || !xlsxFile.files.length) {
        if (importMsg) importMsg.textContent = "Vyber XLSX soubor.";
        return;
      }

      const formData = new FormData();
      formData.append("file", xlsxFile.files[0]);

      if (importMsg) importMsg.textContent = "Importuji…";

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
      }
    });
  }

  // start
  checkAuth();
});
