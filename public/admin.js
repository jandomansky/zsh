const loginCard = document.getElementById("loginCard");
const adminCard = document.getElementById("adminCard");
const logoutBtn = document.getElementById("logoutBtn");

const loginForm = document.getElementById("loginForm");
const passwordEl = document.getElementById("password");
const loginMsg = document.getElementById("loginMsg");

function setMsg(text, ok = false) {
  loginMsg.textContent = text;
  loginMsg.className = "msg " + (ok ? "ok" : "bad");
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

function showAdmin() {
  loginCard.hidden = true;
  adminCard.hidden = false;
  logoutBtn.hidden = false;
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
  setMsg("");
  try {
    await api("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: passwordEl.value })
    });
    passwordEl.value = "";
    setMsg("Přihlášeno.", true);
    await checkAuth();
  } catch {
    setMsg("Špatné heslo nebo chyba.", false);
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

