export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB
      .prepare("SELECT * FROM racers ORDER BY last_name ASC")
      .all();

    return new Response(JSON.stringify({
      ok: true,
      count: results.length,
      racers: results
    }), {
      headers: { "content-type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({
      ok: false,
      error: "DB error",
      message: String(e?.message || e)
    }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}
