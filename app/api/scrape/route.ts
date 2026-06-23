import { NextResponse } from "next/server";
import {
  dispatchScrapeWorkflow,
  getScrapeWorkflowStatus,
} from "@/lib/scrape-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ scrape: getScrapeWorkflowStatus() });
}

export async function POST() {
  const result = await dispatchScrapeWorkflow();

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result, { status: 202 });
}
