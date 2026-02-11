const loginCard = document.getElementById("loginCard");
const adminCard = document.getElementById("adminCard");
const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");
const passwordEl = document.getElementById("password");
const loginMsg = document.getElementById("loginMsg");

function setMsg(text, ok = false) {
  if (!loginMsg) return; // bezpečně, když element chybí
  loginMsg.textContent = text;
  loginMsg.className = "msg " + (ok ? "ok" : "bad");
}


async function api(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    ...opts,
    headers: {
      ...(opts.headers || {})
    }
  });

  const ct = res.headers.get("content-type") || "";
  const isJson = ct.includes("application/json");
  const data = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

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
  loginCard.hidden = true;
  adminCard.hidden = false;
  logoutBtn.hidden = false;

  // auto-refresh po přihlášení
  loadRacers();
}

function showLogin() {
  loginCard.hidden = false;
  adminCard.hidden = true;
  logoutBtn.hidden = true;
}

async function checkAuth() {
  try {
    const me = await api("/api/me");
    if (me.authenticated) showAdmin();
    else showLogin();
  } catch {
    showLogin();
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg("", true);
  try {
   await api("/api/login", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ password: passwordEl.value })
});

passwordEl.value = "";
setMsg("Přihlášeno.", true);
await checkAuth();

  } catch (e) {
  setMsg("Chyba: " + (e?.message || e), false);
}

});

// jednoduchý logout endpoint zatím nemáš, zatím cookie jen „dožije“
// pro teď uděláme jen hard refresh a schováme admin část
logoutBtn.addEventListener("click", async () => {
  // zatím pouze lokální “logout” UI
  showLogin();
  setMsg("Odhlášení: zatím nemáme endpoint, session vyprší sama.", false);
});

checkAuth();
const reloadBtn = document.getElementById("reloadBtn");
const racersBody = document.getElementById("racersBody");
const racersMsg = document.getElementById("racersMsg");

const recalculateBtn = document.getElementById("recalculateBtn");

async function recalculateStartNumbers() {
  if (!recalculateBtn) return;

  recalculateBtn.disabled = true;
  racersMsg.textContent = "Přepočítávám startovní čísla…";

  try {
    await api("/api/recalculate-start-numbers", { method: "POST" });
    racersMsg.textContent = "Hotovo ✅ Startovní čísla přepočítána.";
    await loadRacers();
  } catch (e) {
    racersMsg.textContent = "Chyba přepočtu: " + (e?.message || e);
  } finally {
    recalculateBtn.disabled = false;
  }
}

if (recalculateBtn) {
  recalculateBtn.addEventListener("click", recalculateStartNumbers);
}

function esc(s) {
  return String(s ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
}

function renderRacers(rows) {
  racersBody.innerHTML = rows.map(r => `
    <tr>
      <td>${esc(r.last_name)}</td>
      <td>${esc(r.first_name)}</td>
      <td>${esc(r.birth_date)}</td>
      <td>${esc(r.team)}</td>
      <td>${esc(r.disciplines)}</td>
      <td>${esc(r.category_os)}</td>
      <td>${esc(r.start_number)}</td>
    </tr>
  `).join("");
}

async function loadRacers() {
  racersMsg.textContent = "Načítám…";
  try {
    const data = await api("/api/racers");
    renderRacers(data.racers || []);
    racersMsg.textContent = `Načteno: ${data.count || 0}`;
  } catch (e) {
    racersMsg.textContent = "Chyba načítání: " + e.message;
  }
}

reloadBtn.addEventListener("click", loadRacers);


const xlsxFile = document.getElementById("xlsxFile");
const importBtn = document.getElementById("importBtn");
const importMsg = document.getElementById("importMsg");

importBtn.addEventListener("click", async () => {
  if (!xlsxFile.files.length) {
    importMsg.textContent = "Vyber XLSX soubor.";
    return;
  }

  const formData = new FormData();
  formData.append("file", xlsxFile.files[0]);

  importMsg.textContent = "Importuji…";

  try {
    const res = await fetch("/api/import-xlsx", {
      method: "POST",
      body: formData,
      credentials: "include"
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Import failed");

    importMsg.textContent = `Import OK. Vloženo: ${data.inserted}`;
    await loadRacers();
  } catch (e) {
    importMsg.textContent = "Chyba: " + e.message;
  }
});


