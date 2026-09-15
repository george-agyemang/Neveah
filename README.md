# Study Buddies — deploy to george-agyemang/Neveah

## What you need first

- A free **Anthropic API key**: console.anthropic.com → API Keys → Create key.
- Your GitHub repo (already created: github.com/george-agyemang/Neveah) and a
  Cloudflare account.

## 1. Push these files into your repo

If your repo is currently empty:

```bash
cd study-buddies
git init
git add .
git commit -m "Study Buddies revision app"
git remote add origin https://github.com/george-agyemang/Neveah.git
git branch -M main
git push -u origin main
```

If the repo already has something in it (e.g. a README GitHub added
automatically), clone it first and copy the files in instead:

```bash
git clone https://github.com/george-agyemang/Neveah.git
cp -r study-buddies/* study-buddies/.[!.]* Neveah/ 2>/dev/null
cd Neveah
git add .
git commit -m "Study Buddies revision app"
git push
```

You should end up with this structure in the repo root:

```
public/
  index.html
  manifest.json
  icon.png
functions/
  api/
    progress.js
    plan.js
    activity.js
    content.js
```

## 2. Connect Cloudflare Pages to the repo

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** →
   **Connect to Git** → authorise Cloudflare for GitHub if asked → pick
   **george-agyemang/Neveah**.
2. Build settings:
   - Framework preset: **None**
   - Build command: *(leave blank)*
   - Build output directory: `public`
3. Click **Save and Deploy**. First build takes under a minute and gives you
   a URL like `neveah.pages.dev` (or `neveah-xyz.pages.dev` if that name's
   taken).

At this point the site loads, but the API calls will fail — that's expected,
finish steps 3 and 4 first.

## 3. Create the KV namespace (shared storage)

This one namespace backs all three storage endpoints (progress, plan,
activity), so you only do this once.

1. Cloudflare dashboard → **Workers & Pages** → **KV** → **Create namespace**
   → name it e.g. `neveah-storage`.
2. Back in your Pages project → **Settings** → **Functions** →
   **KV namespace bindings** → **Add binding**:
   - Variable name: `PROGRESS_KV`
   - KV namespace: the one you just created
3. This won't take effect until the next deploy (step 5 covers that).

## 4. Add your Anthropic API key as a secret

Same Pages project → **Settings** → **Environment variables** → **Add
variable**:
- Name: `ANTHROPIC_API_KEY`
- Value: your key from console.anthropic.com
- Tick **Encrypt** (makes it a secret, never exposed to the browser)
- Apply to **Production** (and **Preview** too, if you want preview builds
  to work as well)

## 5. Redeploy so the new settings take effect

Pages project → **Deployments** → **···** on the latest deployment →
**Retry deployment**. (Any KV binding or environment variable change only
applies to deployments made *after* it was saved, so this step is required.)

## 6. Check it actually works

Open your `.pages.dev` URL. Tap into any topic and open its Summary tab —
if it loads real content after a few seconds, the API key and KV binding are
both wired up correctly. If you get a "Couldn't fetch content" error, it's
almost always one of:
- KV binding variable name isn't exactly `PROGRESS_KV`
- API key wasn't applied to "Production"
- you didn't redeploy after adding either of the above

## 7. Give it to your daughter

Open the same URL on her phone:
- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** ⋮ menu → Add to Home Screen / Install app

## Optional: custom domain

Pages project → **Custom domains** → add a domain or subdomain you own
through Cloudflare instead of the `.pages.dev` address.

## Optional: keep it just between you two

Anyone with the URL can open and use it. To lock it down: Cloudflare
dashboard → **Zero Trust** → **Access** → **Applications** → protect the
Pages domain with an email/one-time-PIN check for just your two addresses.
Free for small teams.

## Making changes later

Edit the files and `git push` — Cloudflare rebuilds automatically in under a
minute. No server to maintain.

## Cost

- Cloudflare Pages + Functions + KV: free at this scale.
- Anthropic API: charged only the first time each of the 230 topics is
  opened (then cached in KV permanently, until someone hits "Regenerate
  content"). A low one-off cost, roughly a few pence per topic.
