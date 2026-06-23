import { NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/store";
import type { SearchProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isPositiveIntOrNull(v: unknown): v is number | null | undefined {
  if (v == null) return true;
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
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
    !isStringArray(body.mustKeywords) ||
    !isStringArray(body.goodKeywords) ||
    !isStringArray(body.groupIds)
  ) {
    return NextResponse.json(
      {
        error:
          "locations, mustKeywords, goodKeywords, and groupIds must all be string arrays",
      },
      { status: 400 },
    );
  }
  if (
    !isPositiveIntOrNull(body.priceMinLkr) ||
    !isPositiveIntOrNull(body.priceMaxLkr) ||
    !isPositiveIntOrNull(body.maxAgeHours)
  ) {
    return NextResponse.json(
      { error: "priceMinLkr, priceMaxLkr, and maxAgeHours must be non-negative numbers or null" },
      { status: 400 },
    );
  }
  const profile: SearchProfile = {
    locations: body.locations,
    mustKeywords: body.mustKeywords,
    goodKeywords: body.goodKeywords,
    groupIds: body.groupIds,
    priceMinLkr: body.priceMinLkr ?? undefined,
    priceMaxLkr: body.priceMaxLkr ?? undefined,
    includeUnpriced: body.includeUnpriced !== false, // default true
    maxAgeHours: body.maxAgeHours ?? undefined,
  };
  const saved = await saveProfile(profile);
  return NextResponse.json({ profile: saved });
}
