// GET  /api/activity  -> returns the shared activity log array
// PUT  /api/activity  -> replaces the shared activity log array
//
// Uses the same KV namespace as progress.js (PROGRESS_KV) with a different
// key, so no extra binding is needed.

export async function onRequestGet(context) {
  const { env } = context;
  const value = await env.PROGRESS_KV.get("activity-log");
  return new Response(value || "[]", {
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

  await env.PROGRESS_KV.put("activity-log", body);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
}
