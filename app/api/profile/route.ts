import { NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/store";
import type { SearchProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export async function GET() {
  const profile = await getProfile();
  return NextResponse.json({ profile });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (
    !body ||
    !isStringArray(body.locations) ||
    !isStringArray(body.keywords) ||
    !isStringArray(body.groupIds)
  ) {
    return NextResponse.json(
      { error: "locations, keywords, and groupIds must all be string arrays" },
      { status: 400 },
    );
  }
  const profile: SearchProfile = {
    locations: body.locations,
    keywords: body.keywords,
    groupIds: body.groupIds,
  };
  const saved = await saveProfile(profile);
  return NextResponse.json({ profile: saved });
}
