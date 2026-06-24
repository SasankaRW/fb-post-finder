/**
 * FB group post scraper.
 *
 * - Loads cookies from FB_COOKIES (JSON array, in Playwright cookie format)
 * - For each saved group, opens the group page and extracts visible posts
 * - Writes new/updated posts to the JSON store via lib/store
 *
 * Run locally:   npm run scrape
 * Prereq once:   npm run scrape:install-browser
 *
 * Cookies: log into Facebook in a browser, export cookies as JSON
 * (e.g. with the "Cookie-Editor" extension → "Export → JSON"), then:
 *   - For local runs: put the JSON into a `.env.local` line:
 *       FB_COOKIES='[ ... ]'
 *     and run `npm run scrape`
 *   - For GitHub Actions: paste the JSON into a repo secret named FB_COOKIES.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext, type Cookie } from "playwright";
import { getGroups, getProfile, upsertPosts } from "../lib/store";
import { filterPosts } from "../lib/filter";
import type { Post } from "../lib/types";

const MAX_SCROLLS = 25;
const SCROLL_DELAY_MS = 2500;
const PRICE_RE = /(?:rs|lkr|rs\.|lkr\.)\s*([\d,]{3,})|(\d{2,3}[,\.]?\d{3})\s*\/?=?/i;

// "See more" expand-control labels across the languages these groups use.
// FB renders the control as a clickable element whose text is exactly one of
// these; clicking expands the post inline (no navigation).
const SEE_MORE_LABELS = [
  "see more",
  "තවත් බලන්න", // Sinhala
  "மேலும் பார்க்க", // Tamil
  "ещё", // (other locales, harmless extras)
  "voir plus",
  "ver más",
];

function normalizeSameSite(v: unknown): "Strict" | "Lax" | "None" {
  if (typeof v !== "string") return "Lax";
  const s = v.toLowerCase();
  if (s === "strict") return "Strict";
  if (s === "none" || s === "no_restriction") return "None";
  // "lax", "unspecified", "", or anything unexpected → safe default
  return "Lax";
}

async function loadCookies(): Promise<Cookie[]> {
  // Prefer env var (works for GH Actions); fall back to .env.local for dev convenience.
  let raw = process.env.FB_COOKIES;
  if (!raw) {
    try {
      const envFile = await fs.readFile(
        path.join(process.cwd(), ".env.local"),
        "utf-8",
      );
      const match = envFile.match(/^FB_COOKIES\s*=\s*['"]?(.+?)['"]?\s*$/m);
      if (match) raw = match[1];
    } catch {}
  }
  if (!raw) {
    throw new Error(
      "FB_COOKIES is not set. Export your Facebook cookies (JSON) and set FB_COOKIES.",
    );
  }
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  // Normalize to Playwright Cookie shape. Common exports use 'expirationDate' (sec) instead of 'expires'.
  return parsed.map((c) => {
    const out: Cookie = {
      name: String(c.name),
      value: String(c.value),
      domain: String(c.domain ?? ".facebook.com"),
      path: String(c.path ?? "/"),
      httpOnly: Boolean(c.httpOnly),
      secure: c.secure !== false,
      sameSite: normalizeSameSite(c.sameSite),
      expires:
        typeof c.expires === "number"
          ? c.expires
          : typeof c.expirationDate === "number"
            ? Math.floor(c.expirationDate)
            : -1,
    };
    return out;
  });
}

function extractPrice(text: string): number | undefined {
  const m = text.match(PRICE_RE);
  if (!m) return undefined;
  const raw = (m[1] || m[2] || "").replace(/[^\d]/g, "");
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1000 || n > 10_000_000) return undefined;
  return n;
}

async function scrapeGroup(
  ctx: BrowserContext,
  group: { id: string; name: string; url: string },
): Promise<Post[]> {
  const page = await ctx.newPage();
  console.log(`→ ${group.name} (${group.url})`);
  await page.goto(group.url, { waitUntil: "domcontentloaded", timeout: 60_000 });

  // Bail early if FB redirected us to login.
  if (page.url().includes("/login")) {
    console.warn(`  ! redirected to login — cookies may be expired`);
    await page.close();
    return [];
  }

  // FB virtualizes the feed: only posts near the viewport exist in the DOM at
  // any moment, and they're destroyed as they scroll out of view. So we harvest
  // after every scroll step and accumulate, keyed by permalink, instead of
  // reading the DOM once at the end.
  type Row = { text: string; permalink: string; author: string | null };
  const byPermalink = new Map<string, Row>();

  // The post body lives in one of FB's "message" wrappers. Comments, reaction
  // bars and "Like · Reply" chrome are OUTSIDE it, so reading from here keeps
  // us to the post description only. We list every wrapper FB's Comet web UI
  // uses; the extractor tries them in order and falls back if none match.
  const MESSAGE_SELECTOR = [
    '[data-ad-comet-preview="message"]',
    '[data-ad-preview="message"]',
    '[data-ad-rendering-role="story_message"]',
  ].join(", ");

  // Click only the "See more" that belongs to a post message (scoped inside the
  // message wrapper) so the full description is in the DOM — and so we never
  // expand comment threads.
  const expandSeeMore = async () => {
    try {
      const clicked = await page.evaluate(
        ({ labels, messageSelector }: { labels: string[]; messageSelector: string }) => {
          let n = 0;
          const messages = document.querySelectorAll<HTMLElement>(messageSelector);
          messages.forEach((msg) => {
            const controls = msg.querySelectorAll<HTMLElement>(
              'div[role="button"], span[role="button"], a[role="button"]',
            );
            controls.forEach((el) => {
              const t = (el.textContent || "").trim().toLowerCase();
              if (labels.includes(t)) {
                el.click();
                n++;
              }
            });
          });
          return n;
        },
        { labels: SEE_MORE_LABELS, messageSelector: MESSAGE_SELECTOR },
      );
      if (clicked > 0) await page.waitForTimeout(700);
    } catch {
      // Expansion is best-effort; never let it abort a scrape.
    }
  };

  const harvest = async () => {
    await expandSeeMore();
    const found = await page.locator('div[role="article"]').evaluateAll(
      (articles, messageSelector) => {
        const out: Array<{ text: string; permalink: string; author: string | null }> = [];
        for (const a of articles) {
          const el = a as HTMLElement;

          // Skip nested articles (comments) — only process top-level posts.
          if (el.parentElement?.closest('div[role="article"]')) continue;

          // Prefer FB's known post-message wrappers (clean: excludes comments
          // and chrome by construction).
          let text = "";
          const msgEl = el.querySelector<HTMLElement>(messageSelector);
          if (msgEl) {
            text = msgEl.innerText?.trim() ?? "";
          } else {
            // Fallback for layout variants with no message wrapper: gather the
            // post's own text blocks, excluding anything inside a nested
            // comment article. Recovers posts we'd otherwise skip entirely.
            const nested = Array.from(el.querySelectorAll('div[role="article"]'));
            const inComment = (n: Node) => nested.some((na) => na !== el && na.contains(n));
            const blocks = Array.from(el.querySelectorAll<HTMLElement>('div[dir="auto"]'))
              .filter((b) => !inComment(b))
              .map((b) => b.innerText.trim())
              .filter((t) => t.length > 0);
            text = Array.from(new Set(blocks)).join("\n").trim();
          }
          if (!text || text.length < 20) continue;

          // Match the post permalink in any of FB's link shapes.
          const link = el.querySelector<HTMLAnchorElement>(
            'a[href*="/posts/"], a[href*="/permalink/"], a[href*="permalink.php"], a[href*="story_fbid"], a[href*="multi_permalinks"]',
          );
          if (!link?.href) continue;
          const permalink = link.href.split("?")[0];
          const authorEl = el.querySelector<HTMLElement>(
            'h3 a, h2 a, strong a, [aria-label] strong',
          );
          out.push({ text, permalink, author: authorEl?.innerText?.trim() || null });
        }
        return out;
      },
      MESSAGE_SELECTOR,
    );
    for (const r of found) {
      // Keep the longest text version we've seen (posts expand "See more" lazily).
      const prev = byPermalink.get(r.permalink);
      if (!prev || r.text.length > prev.text.length) byPermalink.set(r.permalink, r);
    }
  };

  let stagnantScrolls = 0;
  for (let i = 0; i < MAX_SCROLLS; i++) {
    await harvest();
    const before = byPermalink.size;
    // Scroll the window itself (more reliable headless than mouse wheel) and
    // give FB time to fetch + render the next batch.
    await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    await page.waitForTimeout(SCROLL_DELAY_MS);
    // Nudge lazy-loaders that only fire on a real wheel event.
    await page.mouse.wheel(0, 3000);
    await page.waitForTimeout(400);
    await harvest();
    // Stop early only after several truly empty scrolls (end of feed).
    if (byPermalink.size === before) {
      if (++stagnantScrolls >= 4) break;
    } else {
      stagnantScrolls = 0;
    }
    console.log(`    …scroll ${i + 1}: ${byPermalink.size} posts so far`);
  }

  await page.close();
  const rows = [...byPermalink.values()];
  console.log(`  found ${rows.length} candidate posts`);

  const nowIso = new Date().toISOString();
  const posts: Post[] = rows.map((r) => {
    const idMatch = r.permalink.match(/(?:posts|permalink)\/([^/?#]+)/);
    const id = `fb_${group.id}_${idMatch?.[1] ?? Buffer.from(r.permalink).toString("base64url").slice(0, 24)}`;
    return {
      id,
      groupId: group.id,
      groupName: group.name,
      author: r.author || "Unknown",
      text: r.text,
      permalink: r.permalink,
      postedAt: nowIso, // FB hides exact timestamps in DOM; we record scrape time as best-effort
      priceLkr: extractPrice(r.text),
    };
  });

  return posts;
}

async function main() {
  const cookies = await loadCookies();
  const groups = await getGroups();
  if (groups.length === 0) {
    console.log("No groups configured. Add some in the UI first.");
    return;
  }

  // Load the saved filters so we only store posts that actually match.
  const profile = await getProfile();
  // We already chose which groups to scrape, so don't re-apply the group
  // filter here — only keyword/location/price filters matter at this stage.
  const scrapeFilter = { ...profile, groupIds: [] };
  const hasKeywordFilter =
    profile.locations.length > 0 ||
    profile.mustKeywords.length > 0 ||
    profile.goodKeywords.length > 0;
  console.log(
    hasKeywordFilter
      ? `Filtering with: locations=[${profile.locations.join(", ")}] must=[${profile.mustKeywords.join(
          ", ",
        )}] good=[${profile.goodKeywords.join(", ")}]`
      : "No keyword filters set — storing every post. Add filters in Settings.",
  );

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });
  await ctx.addCookies(cookies);

  let totalAdded = 0;
  for (const g of groups) {
    try {
      const posts = await scrapeGroup(ctx, g);
      if (posts.length === 0) continue;
      // Keep only posts that match the saved keywords/location/price filters.
      const matched = filterPosts(posts, scrapeFilter);
      console.log(`  ${matched.length}/${posts.length} match your filters`);
      if (matched.length === 0) continue;
      const { added, total } = await upsertPosts(matched);
      console.log(`  + ${added} new (store has ${total} total)`);
      totalAdded += added;
    } catch (err) {
      console.error(`  ! error scraping ${g.name}:`, err);
    }
  }

  await ctx.close();
  await browser.close();
  console.log(`\nDone. Added ${totalAdded} new posts across ${groups.length} groups.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
