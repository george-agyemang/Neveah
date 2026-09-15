// GET  /api/plan  -> returns the shared study-plan settings object
// PUT  /api/plan  -> replaces the shared study-plan settings object
//
// Uses the same KV namespace as progress.js (PROGRESS_KV) with a different
// key, so no extra binding is needed.

export async function onRequestGet(context) {
  const { env } = context;
  const value = await env.PROGRESS_KV.get("study-plan");
  return new Response(value || "null", {
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const body = await request.text();

  try {
    JSON.parse(body);
  } catch (e) {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await env.PROGRESS_KV.put("study-plan", body);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
}
