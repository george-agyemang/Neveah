# Study Buddies — deploy to george-agyemang/Neveah

Cloudflare's default flow for new projects now goes through **Workers**
(which can serve static sites + backend logic together) rather than the
older, separate **Pages** product. This repo is set up for that flow: one
Worker script (`src/index.js`) serves the app from `public/` and handles the
four API routes, configured by `wrangler.jsonc`.

## What you need first

- A free **Anthropic API key**: console.anthropic.com → API Keys → Create key.
- Your GitHub repo (github.com/george-agyemang/Neveah) and a Cloudflare
  account.

## 1. Create the KV namespace first

You need this namespace's ID before the deploy will work, so do this before
pushing anything.

1. Cloudflare dashboard → **Workers & Pages** → **KV** → **Create a
   namespace** → name it e.g. `neveah-storage`.
2. Click into the namespace you just created and copy its **ID** (a long
   string of letters/numbers shown on that page).

## 2. Fill in the KV namespace ID

Open `wrangler.jsonc` in this folder and replace
`REPLACE_WITH_YOUR_KV_NAMESPACE_ID` with the ID you just copied:

```jsonc
"kv_namespaces": [
  { "binding": "PROGRESS_KV", "id": "your-actual-id-here" }
]
```

## 3. Push everything into your repo

Using GitHub's website (no terminal needed):

1. Go to github.com/george-agyemang/Neveah
2. **Add file** → **Upload files**
3. Drag in the `public` folder, the `src` folder, `wrangler.jsonc`, and this
   `README.md` — drag those items themselves, not an outer folder wrapping
   them, so they land at the top level of the repo
4. Commit changes

You should end up with this at the repo root:

```
public/
  index.html
  manifest.json
  icon.png
src/
  index.js
wrangler.jsonc
```

## 4. Continue the "Create an app" flow in Cloudflare

Back in the Cloudflare dashboard, in the same setup screen you were on
(Configure your Worker project):
- **Project name**: leave as-is or rename
- **Build command**: leave blank
- **Deploy command**: leave as `npx wrangler deploy` (this is correct now
  that `wrangler.jsonc` exists)
- Click **Deploy**

It reads `wrangler.jsonc`, deploys `src/index.js` as the Worker, uploads
`public/` as static assets, and wires up the KV binding automatically since
it's declared in the config file. You'll get a URL ending in
`.workers.dev` (or your project name, e.g. `neveah.<you>.workers.dev`).

## 5. Add your Anthropic API key as a secret

The API key should never be committed to the repo, so it's added separately
in the dashboard:

1. Open your Worker in the Cloudflare dashboard (Workers & Pages → your
   project)
2. **Settings** → **Variables and Secrets** → **Add**
3. Name: `ANTHROPIC_API_KEY`, Value: your key from console.anthropic.com,
   Type: **Secret** (encrypted)
4. Save, then trigger a new deployment (Deployments tab → retry the latest
   one) so the Worker picks it up

## 6. Check it actually works

Open your Worker's URL, tap into any topic, open its Summary tab. Real
content loading after a few seconds means the KV binding and API key are
both wired up correctly. A "Couldn't fetch content" error usually means:
- The KV namespace ID in `wrangler.jsonc` doesn't match the one you created
- The API key wasn't saved as a **Secret** (not a plain variable)
- You didn't redeploy after adding the secret

## 7. Give it to your daughter

Open the same URL on her phone:
- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** ⋮ menu → Add to Home Screen / Install app

## Optional: custom domain

Worker → **Settings** → **Domains & Routes** → add a domain or subdomain you
own through Cloudflare, instead of the `.workers.dev` address.

## Optional: keep it just between you two

Anyone with the URL can open and use it. To lock it down: Cloudflare
dashboard → **Zero Trust** → **Access** → **Applications** → protect the
Worker's domain with an email/one-time-PIN check for just your two
addresses. Free for small teams.

## Making changes later

Edit the files and push to GitHub (via the same Upload files flow, or `git`
if you set that up later) — Cloudflare rebuilds automatically.

## Cost

- Cloudflare Workers (this scale) + KV: free.
- Anthropic API: charged only the first time each of the 230 topics is
  opened (then cached in KV permanently, until someone hits "Regenerate
  content"). A low one-off cost, roughly a few pence per topic.
