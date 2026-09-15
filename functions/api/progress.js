// GET  /api/progress  -> returns the shared progress object
// PUT  /api/progress  -> replaces the shared progress object
//
// Requires a KV namespace bound as PROGRESS_KV in the Cloudflare Pages
// project settings (Settings > Functions > KV namespace bindings).

export async function onRequestGet(context) {
  const { env } = context;
  const value = await env.PROGRESS_KV.get("progress");
  return new Response(value || "{}", {
    headers: { "content-type": "application/json" },
  });
}

export async function onRequestPut(context) {
  const { request, env } = context;
  const body = await request.text();

  // Basic sanity check so a malformed request can't wipe good data.
  try {
    JSON.parse(body);
  } catch (e) {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  await env.PROGRESS_KV.put("progress", body);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
}
