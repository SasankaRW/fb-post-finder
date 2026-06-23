## FB Rental Finder

A tiny Next.js app that filters Facebook group posts for what you care about (e.g. *annex, 2 rooms, kitchen in Malabe*) and shows the matching posts with their original FB links.

The scraping is split from the frontend on purpose:

```
GitHub Actions (every 5h)    Vercel (frontend)
  Playwright scraper    ──>    Next.js UI
        │                        │
        └──── data/*.json ◄──────┘   (committed to repo by the cron)
```

This keeps everything on free tiers.

### Phases

- **Phase 1 (done)** — UI scaffold with multi-select for locations / keywords / groups, results view, all on mock data.
- **Phase 2 (done)** — JSON-file persistence + API routes (`/api/groups`, `/api/posts`, `/api/profile`), Playwright scraper script, GitHub Actions workflow for the 5h cron.
- **Phase 3 (when ready to deploy)** — swap the JSON store for Neon Postgres so the live Vercel deployment can also accept group/profile edits (see "Going to production" below).

---

### Run it locally

```sh
npm install
npm run dev
# open http://localhost:3000
```

Settings (locations, keywords, groups) are saved to `data/*.json` next to the project, so they survive restarts.

### Run the scraper locally

One-time browser install:

```sh
npm run scrape:install-browser
```

Get your Facebook session cookies (use a **secondary FB account** — there's a small ToS/ban risk):
1. Log into facebook.com in a browser as your secondary account.
2. Install the "Cookie-Editor" extension (or any cookie exporter).
3. On facebook.com, click "Export → JSON". You get an array like `[{"name":"c_user", ...}, ...]`.
4. Create `.env.local` in the project root:
   ```
   FB_COOKIES='<paste the JSON here on one line>'
   ```

Then:

```sh
npm run scrape
```

The script logs each group it visits, how many posts it found, and how many were new. New posts are appended (deduped by FB post ID) to `data/posts.json`. Refresh the UI to see them.

> Tip: the scraper account must be a **member** of every group you want to scrape.

### Automate with GitHub Actions

`.github/workflows/scrape.yml` is already set up to run the scraper every 5 hours. To enable it:

1. Push this repo to GitHub.
2. Repo → Settings → Secrets and variables → Actions → "New repository secret".
   - **Name**: `FB_COOKIES`
   - **Value**: the same JSON you put in `.env.local`.
3. The first run will be on the next 5-hour mark. Trigger manually any time with "Actions → Scrape FB groups → Run workflow".

The workflow commits the updated `data/posts.json` back to the repo. If you've also connected the repo to Vercel, Vercel will auto-redeploy with the fresh posts.

When the cookies expire (usually monthly), the scraper run will log "redirected to login" — just re-export cookies and update the secret.

---

### Going to production (Phase 3) — Neon Postgres

The store auto-switches backends based on `DATABASE_URL`:

- **`DATABASE_URL` not set** → JSON files in `data/` (local dev default, zero setup).
- **`DATABASE_URL` set** → Neon Postgres (lib/store-pg.ts). Schema is created automatically on first call (`CREATE TABLE IF NOT EXISTS …`).

Step-by-step:

**1. Create a Neon database**
- Sign up at [neon.tech](https://neon.tech) (free tier — 0.5 GB storage, plenty).
- Create a project. Pick the region closest to your Vercel deployment.
- Dashboard → "Connection string" → copy the **pooled** connection string (looks like `postgresql://user:pwd@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`).

**2. Deploy the frontend to Vercel**
- Push the repo to GitHub if you haven't already.
- [vercel.com](https://vercel.com) → New Project → import the repo.
- **Root directory**: set to `screper` (since the project lives in a subfolder).
- Environment variables → add `DATABASE_URL` with the Neon connection string.
- Deploy. First deploy creates the tables automatically.

**3. Give the scraper access too**
The GitHub Actions cron also needs to write to the same DB:
- Repo → Settings → Secrets and variables → Actions → New secret
- Name: `DATABASE_URL`, value: same Neon connection string

**4. Update the workflow to pass DATABASE_URL to the scraper**

Edit `.github/workflows/scrape.yml` and add `DATABASE_URL` to the scraper step's `env`:

```yaml
      - name: Run scraper
        env:
          FB_COOKIES: ${{ secrets.FB_COOKIES }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: npm run scrape
```

Once `DATABASE_URL` is in the env, the scraper writes posts straight to Neon — no more commit-back. You can also drop the "Commit updated posts" step from the workflow.

**Now the data flow is:**

```
GitHub Actions (every 5h)        Vercel (frontend)
  Playwright scraper ──writes──►  Neon Postgres ◄──reads── Next.js UI
```

Editing groups / locations / keywords in the live UI now persists — Vercel writes to Neon, scraper reads groups from Neon on its next run.

**Migrating your existing local data (optional)**

If you've already added some groups locally and want to keep them, the easiest path is just re-add them in the deployed UI. If you have many, you can run a one-off:

```sh
DATABASE_URL='postgresql://...' npm run dev   # locally, but pointed at Neon
# Open localhost:3000 and add groups via the UI — they save to Neon.
```

The function signatures in `lib/store-json.ts` and `lib/store-pg.ts` are identical, so the rest of the code never knows which is active.

---

### File layout

```
app/
  page.tsx              # main UI
  layout.tsx, globals.css
  api/
    groups/route.ts     # GET / POST / DELETE
    posts/route.ts      # GET (with filter query params)
    profile/route.ts    # GET / PUT
components/
  MultiSelect.tsx       # chips-style multi-select w/ suggestions + custom values
  GroupManager.tsx      # add / remove / toggle FB groups
  PostCard.tsx          # single matched-post card
lib/
  types.ts              # FbGroup, Post, SearchProfile, MatchedPost
  seed.ts               # seed data + suggested locations/keywords
  filter.ts             # location/keyword matching
  store.ts              # JSON-file persistence (swap for Postgres in Phase 3)
  api.ts                # browser-side API client
scripts/
  scrape.ts             # Playwright scraper (FB groups → data/posts.json)
.github/workflows/
  scrape.yml            # cron job: runs scraper every 5h, commits posts back
data/                   # JSON store (created on first run)
```

### Caveats

- **FB account risk** — scraping a logged-in account violates FB ToS. Use a secondary/throwaway account. The scraper is read-only (no posting).
- **Selectors break** — FB changes their HTML occasionally. If the scraper logs `found 0 candidate posts` consistently, the selector in `scripts/scrape.ts` needs updating.
- **Best-effort timestamps** — FB hides exact post times in the DOM (they show "5 hrs" etc.); the scraper records the time it found the post, not the time it was posted. Good enough for "what's new in the last few hours".
