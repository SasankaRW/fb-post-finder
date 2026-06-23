import { promises as fs } from "node:fs";
import path from "node:path";
import type { FbGroup, Post, SearchProfile } from "./types";
import { SEED_GROUPS } from "./seed";

const DATA_DIR = path.join(process.cwd(), "data");
const GROUPS_FILE = path.join(DATA_DIR, "groups.json");
const POSTS_FILE = path.join(DATA_DIR, "posts.json");
const PROFILE_FILE = path.join(DATA_DIR, "profile.json");

const DEFAULT_PROFILE: SearchProfile = {
  locations: [],
  mustKeywords: [],
  goodKeywords: [],
  groupIds: SEED_GROUPS.map((g) => g.id),
  includeUnpriced: true,
};

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJsonOrSeed<T>(file: string, seed: T): Promise<T> {
  await ensureDir();
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err.code === "ENOENT") {
      await fs.writeFile(file, JSON.stringify(seed, null, 2), "utf-8");
      return seed;
    }
    throw err;
  }
}

async function writeJson<T>(file: string, value: T): Promise<void> {
  await ensureDir();
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf-8");
}

export async function getGroups(): Promise<FbGroup[]> {
  return readJsonOrSeed<FbGroup[]>(GROUPS_FILE, SEED_GROUPS);
}

export async function addGroup(input: { name: string; url: string }): Promise<FbGroup> {
  const groups = await getGroups();
  const id = `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const next: FbGroup = {
    id,
    name: input.name,
    url: input.url,
    addedAt: new Date().toISOString(),
  };
  groups.push(next);
  await writeJson(GROUPS_FILE, groups);
  return next;
}

export async function removeGroup(id: string): Promise<void> {
  const groups = await getGroups();
  const filtered = groups.filter((g) => g.id !== id);
  await writeJson(GROUPS_FILE, filtered);
}

export async function getPosts(): Promise<Post[]> {
  return readJsonOrSeed<Post[]>(POSTS_FILE, []);
}

export async function upsertPosts(incoming: Post[]): Promise<{ added: number; total: number }> {
  const existing = await getPosts();
  const byId = new Map<string, Post>(existing.map((p) => [p.id, p]));
  let added = 0;
  for (const p of incoming) {
    if (!byId.has(p.id)) added++;
    byId.set(p.id, p);
  }
  const merged = [...byId.values()].sort((a, b) =>
    a.postedAt < b.postedAt ? 1 : -1,
  );
  await writeJson(POSTS_FILE, merged);
  return { added, total: merged.length };
}

export async function getProfile(): Promise<SearchProfile> {
  const raw = (await readJsonOrSeed<Record<string, unknown>>(
    PROFILE_FILE,
    DEFAULT_PROFILE as unknown as Record<string, unknown>,
  )) as Partial<SearchProfile> & { keywords?: string[] };
  // Legacy migration: old profile.json had a single `keywords` field. Treat it as must-have.
  const mustKeywords = raw.mustKeywords ?? raw.keywords ?? [];
  const goodKeywords = raw.goodKeywords ?? [];
  return {
    locations: raw.locations ?? [],
    mustKeywords,
    goodKeywords,
    groupIds: raw.groupIds ?? [],
    priceMinLkr: raw.priceMinLkr,
    priceMaxLkr: raw.priceMaxLkr,
    includeUnpriced: raw.includeUnpriced ?? true,
    maxAgeHours: raw.maxAgeHours,
  };
}

export async function saveProfile(profile: SearchProfile): Promise<SearchProfile> {
  await writeJson(PROFILE_FILE, profile);
  return profile;
}
