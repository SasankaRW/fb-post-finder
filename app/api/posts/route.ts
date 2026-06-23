import { NextResponse } from "next/server";
import { getPosts } from "@/lib/store";
import { filterPosts } from "@/lib/filter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseInt32(value: string | null): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.floor(n);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locations = parseCsv(searchParams.get("locations"));
  const mustKeywords = parseCsv(searchParams.get("mustKeywords"));
  const goodKeywords = parseCsv(searchParams.get("goodKeywords"));
  const groupIds = parseCsv(searchParams.get("groupIds"));
  const priceMinLkr = parseInt32(searchParams.get("priceMinLkr"));
  const priceMaxLkr = parseInt32(searchParams.get("priceMaxLkr"));
  const maxAgeHours = parseInt32(searchParams.get("maxAgeHours"));
  const includeUnpriced = searchParams.get("includeUnpriced") !== "false";

  const posts = await getPosts();
  const matched = filterPosts(posts, {
    locations,
    mustKeywords,
    goodKeywords,
    groupIds,
    priceMinLkr,
    priceMaxLkr,
    includeUnpriced,
    maxAgeHours,
  });
  return NextResponse.json({ posts: matched, total: posts.length });
}
