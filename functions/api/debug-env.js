export async function onRequestGet({ env }) {
  const secret = (env.SESSION_SECRET ?? "").toString();
  const admin = (env.ADMIN_PASSWORD ?? "").toString();

  return new Response(JSON.stringify({
    ok: true,
    hasAdminPassword: admin.length > 0,
    adminPasswordLen: admin.length,
    sessionSecretLen: secret.length,
    sessionSecretSample: secret.slice(0, 4) + "..." + secret.slice(-4) // ať vidíš, že to není prázdné
  }), {
    headers: { "content-type": "application/json" }
  });
}
