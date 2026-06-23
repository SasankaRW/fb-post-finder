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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locations = parseCsv(searchParams.get("locations"));
  const keywords = parseCsv(searchParams.get("keywords"));
  const groupIds = parseCsv(searchParams.get("groupIds"));

  const posts = await getPosts();
  const matched = filterPosts(posts, { locations, keywords, groupIds });
  return NextResponse.json({ posts: matched, total: posts.length });
}
