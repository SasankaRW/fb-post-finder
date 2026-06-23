import { neon } from "@neondatabase/serverless";
import type { FbGroup, Post, SearchProfile } from "./types";

let _sql: ReturnType<typeof neon> | null = null;
let _schemaReady: Promise<void> | null = null;

function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to your env.",
    );
  }
  _sql = neon(url);
  return _sql;
}

async function ensureSchema(): Promise<void> {
  if (_schemaReady) return _schemaReady;
  const sql = getSql();
  _schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        group_name TEXT NOT NULL,
        author TEXT NOT NULL,
        body TEXT NOT NULL,
        permalink TEXT NOT NULL,
        posted_at TIMESTAMPTZ NOT NULL,
        price_lkr INTEGER
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS posts_posted_at_idx ON posts (posted_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY,
        locations TEXT[] NOT NULL DEFAULT '{}',
        must_keywords TEXT[] NOT NULL DEFAULT '{}',
        good_keywords TEXT[] NOT NULL DEFAULT '{}',
        group_ids TEXT[] NOT NULL DEFAULT '{}',
        price_min_lkr INTEGER,
        price_max_lkr INTEGER,
        include_unpriced BOOLEAN NOT NULL DEFAULT TRUE,
        max_age_hours INTEGER
      )
    `;
    // Additive migrations — safe to re-run on older DBs.
    await sql`ALTER TABLE profile ADD COLUMN IF NOT EXISTS must_keywords TEXT[] NOT NULL DEFAULT '{}'`;
    await sql`ALTER TABLE profile ADD COLUMN IF NOT EXISTS good_keywords TEXT[] NOT NULL DEFAULT '{}'`;
    await sql`ALTER TABLE profile ADD COLUMN IF NOT EXISTS price_min_lkr INTEGER`;
    await sql`ALTER TABLE profile ADD COLUMN IF NOT EXISTS price_max_lkr INTEGER`;
    await sql`ALTER TABLE profile ADD COLUMN IF NOT EXISTS include_unpriced BOOLEAN NOT NULL DEFAULT TRUE`;
    await sql`ALTER TABLE profile ADD COLUMN IF NOT EXISTS max_age_hours INTEGER`;
    // If a legacy `keywords` column exists, copy its values into must_keywords (once) and drop it.
    await sql`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'profile' AND column_name = 'keywords'
        ) THEN
          UPDATE profile
             SET must_keywords = keywords
           WHERE (must_keywords IS NULL OR cardinality(must_keywords) = 0)
             AND keywords IS NOT NULL;
          ALTER TABLE profile DROP COLUMN keywords;
        END IF;
      END $$;
    `;
    await sql`
      INSERT INTO profile (id, locations, must_keywords, good_keywords, group_ids, include_unpriced)
      VALUES (1, '{}', '{}', '{}', '{}', TRUE)
      ON CONFLICT (id) DO NOTHING
    `;
  })();
  return _schemaReady;
}

type GroupRow = { id: string; name: string; url: string; added_at: string };
type PostRow = {
  id: string;
  group_id: string;
  group_name: string;
  author: string;
  body: string;
  permalink: string;
  posted_at: string;
  price_lkr: number | null;
};
type ProfileRow = {
  locations: string[];
  must_keywords: string[];
  good_keywords: string[];
  group_ids: string[];
  price_min_lkr: number | null;
  price_max_lkr: number | null;
  include_unpriced: boolean;
  max_age_hours: number | null;
};

function rowToGroup(r: GroupRow): FbGroup {
  return { id: r.id, name: r.name, url: r.url, addedAt: new Date(r.added_at).toISOString() };
}

function rowToPost(r: PostRow): Post {
  return {
    id: r.id,
    groupId: r.group_id,
    groupName: r.group_name,
    author: r.author,
    text: r.body,
    permalink: r.permalink,
    postedAt: new Date(r.posted_at).toISOString(),
    priceLkr: r.price_lkr ?? undefined,
  };
}

export async function getGroups(): Promise<FbGroup[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`SELECT id, name, url, added_at FROM groups ORDER BY added_at ASC`) as GroupRow[];
  return rows.map(rowToGroup);
}

export async function addGroup(input: { name: string; url: string }): Promise<FbGroup> {
  await ensureSchema();
  const sql = getSql();
  const id = `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const addedAt = new Date();
  await sql`
    INSERT INTO groups (id, name, url, added_at)
    VALUES (${id}, ${input.name}, ${input.url}, ${addedAt})
  `;
  return { id, name: input.name, url: input.url, addedAt: addedAt.toISOString() };
}

export async function removeGroup(id: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM groups WHERE id = ${id}`;
}

export async function getPosts(): Promise<Post[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, group_id, group_name, author, body, permalink, posted_at, price_lkr
    FROM posts
    ORDER BY posted_at DESC
  `) as PostRow[];
  return rows.map(rowToPost);
}

export async function upsertPosts(
  incoming: Post[],
): Promise<{ added: number; total: number }> {
  await ensureSchema();
  const sql = getSql();
  if (incoming.length === 0) {
    const totalRows = (await sql`SELECT COUNT(*)::int AS c FROM posts`) as Array<{ c: number }>;
    return { added: 0, total: totalRows[0]?.c ?? 0 };
  }
  // xmax=0 in RETURNING means the row was newly inserted (not updated by ON CONFLICT).
  // Run each upsert via sql.transaction so they batch into one HTTP round-trip.
  const queries = incoming.map(
    (p) => sql`
      INSERT INTO posts (id, group_id, group_name, author, body, permalink, posted_at, price_lkr)
      VALUES (${p.id}, ${p.groupId}, ${p.groupName}, ${p.author}, ${p.text}, ${p.permalink}, ${new Date(p.postedAt)}, ${p.priceLkr ?? null})
      ON CONFLICT (id) DO UPDATE SET
        group_name = EXCLUDED.group_name,
        author = EXCLUDED.author,
        body = EXCLUDED.body,
        permalink = EXCLUDED.permalink,
        price_lkr = EXCLUDED.price_lkr
      RETURNING (xmax = 0) AS inserted
    `,
  );
  const results = (await sql.transaction(queries)) as Array<Array<{ inserted: boolean }>>;
  const added = results.reduce((sum, rows) => sum + (rows[0]?.inserted ? 1 : 0), 0);
  const totalRows = (await sql`SELECT COUNT(*)::int AS c FROM posts`) as Array<{ c: number }>;
  return { added, total: totalRows[0]?.c ?? 0 };
}

export async function getProfile(): Promise<SearchProfile> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT locations, must_keywords, good_keywords, group_ids,
           price_min_lkr, price_max_lkr, include_unpriced, max_age_hours
      FROM profile WHERE id = 1
  `) as ProfileRow[];
  const r =
    rows[0] ?? {
      locations: [],
      must_keywords: [],
      good_keywords: [],
      group_ids: [],
      price_min_lkr: null,
      price_max_lkr: null,
      include_unpriced: true,
      max_age_hours: null,
    };
  return {
    locations: r.locations,
    mustKeywords: r.must_keywords,
    goodKeywords: r.good_keywords,
    groupIds: r.group_ids,
    priceMinLkr: r.price_min_lkr ?? undefined,
    priceMaxLkr: r.price_max_lkr ?? undefined,
    includeUnpriced: r.include_unpriced,
    maxAgeHours: r.max_age_hours ?? undefined,
  };
}

export async function saveProfile(profile: SearchProfile): Promise<SearchProfile> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO profile (
      id, locations, must_keywords, good_keywords, group_ids,
      price_min_lkr, price_max_lkr, include_unpriced, max_age_hours
    )
    VALUES (
      1,
      ${profile.locations},
      ${profile.mustKeywords},
      ${profile.goodKeywords},
      ${profile.groupIds},
      ${profile.priceMinLkr ?? null},
      ${profile.priceMaxLkr ?? null},
      ${profile.includeUnpriced},
      ${profile.maxAgeHours ?? null}
    )
    ON CONFLICT (id) DO UPDATE SET
      locations = EXCLUDED.locations,
      must_keywords = EXCLUDED.must_keywords,
      good_keywords = EXCLUDED.good_keywords,
      group_ids = EXCLUDED.group_ids,
      price_min_lkr = EXCLUDED.price_min_lkr,
      price_max_lkr = EXCLUDED.price_max_lkr,
      include_unpriced = EXCLUDED.include_unpriced,
      max_age_hours = EXCLUDED.max_age_hours
  `;
  return profile;
}
